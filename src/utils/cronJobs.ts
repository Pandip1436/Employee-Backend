import cron, { ScheduledTask } from "node-cron";
import { AttendanceService } from "../services/attendanceService";
import CompanySettings from "../models/CompanySettings";

let autoClockOutTask: ScheduledTask | null = null;
let markAbsentTask: ScheduledTask | null = null;

function parseHHMM(value: string, fallback: [number, number]): [number, number] {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  if (!m) return fallback;
  return [Number(m[1]), Number(m[2])];
}

const DAY_TO_NUM: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function buildCronDow(workingDays: string[] | undefined): string {
  if (!Array.isArray(workingDays) || !workingDays.length) return "1-5"; // safe default
  const nums = Array.from(new Set(
    workingDays
      .map((d) => DAY_TO_NUM[d.toLowerCase()])
      .filter((n) => typeof n === "number")
  )).sort((a, b) => a - b);
  return nums.length ? nums.join(",") : "1-5";
}

/**
 * Stop existing cron tasks (if any) and re-register them using the latest
 * times / timezone from CompanySettings. Safe to call repeatedly — the admin
 * settings update path calls this whenever the relevant fields change.
 */
export async function reloadCronJobs(): Promise<void> {
  autoClockOutTask?.stop();
  markAbsentTask?.stop();
  autoClockOutTask = null;
  markAbsentTask = null;

  let policyTimes = { autoClockOutTime: "19:00", autoMarkAbsentTime: "01:00" };
  let timezone = process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";
  let workingDays: string[] | undefined;
  try {
    const settings = await CompanySettings.findOne()
      .select("attendancePolicy timezone workingDays")
      .lean();
    const policy = (settings as any)?.attendancePolicy || {};
    if (policy.autoClockOutTime) policyTimes.autoClockOutTime = policy.autoClockOutTime;
    if (policy.autoMarkAbsentTime) policyTimes.autoMarkAbsentTime = policy.autoMarkAbsentTime;
    if ((settings as any)?.timezone) timezone = (settings as any).timezone;
    if (Array.isArray((settings as any)?.workingDays)) workingDays = (settings as any).workingDays;
  } catch (err) {
    console.warn("[cron] Could not read CompanySettings, using defaults:", (err as Error).message);
  }

  const [acoH, acoM] = parseHHMM(policyTimes.autoClockOutTime, [19, 0]);
  const [amaH, amaM] = parseHHMM(policyTimes.autoMarkAbsentTime, [1, 0]);
  const cronDow = buildCronDow(workingDays);

  // Auto clock-out — runs only on configured working days, in company timezone
  autoClockOutTask = cron.schedule(
    `${acoM} ${acoH} * * ${cronDow}`,
    async () => {
      try {
        const count = await AttendanceService.autoClockOutAll();
        if (count > 0) console.log(`[cron] Auto clock-out complete: ${count} record(s).`);
      } catch (err) {
        console.error("[cron] Auto clock-out failed:", err);
      }
    },
    { timezone }
  );

  // Auto-mark absent — daily, targets the previous calendar day.
  // Sundays and holidays are skipped inside the service.
  markAbsentTask = cron.schedule(
    `${amaM} ${amaH} * * *`,
    async () => {
      try {
        const yesterday = AttendanceService.getYesterday();
        const result = await AttendanceService.markAbsentForDate(yesterday);
        if (result.created > 0) {
          console.log(`[cron] Auto-mark absent: ${result.created} record(s) for ${yesterday.toISOString().slice(0, 10)}`);
        } else if (result.skipped) {
          console.log(`[cron] Auto-mark absent skipped: ${result.skipped}`);
        }
      } catch (err) {
        console.error("[cron] Auto-mark absent failed:", err);
      }
    },
    { timezone }
  );

  console.log(`[cron] Auto clock-out at ${policyTimes.autoClockOutTime} (DOW=${cronDow}, ${timezone})`);
  console.log(`[cron] Auto-mark absent at ${policyTimes.autoMarkAbsentTime} (daily, ${timezone})`);
}

/**
 * Register all recurring cron jobs.
 * Call once after DB is connected.
 */
export async function registerCronJobs(): Promise<void> {
  await reloadCronJobs();
}
