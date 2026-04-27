import cron from "node-cron";
import { AttendanceService } from "../services/attendanceService";

/**
 * Register all recurring cron jobs.
 * Call once after DB is connected.
 */
export function registerCronJobs() {
  // Auto clock-out at 7:00 PM IST (19:00) every day, Mon–Sat.
  // node-cron runs in the specified timezone.
  cron.schedule(
    "0 19 * * 1-6",
    async () => {
      try {
        const count = await AttendanceService.autoClockOutAll();
        if (count > 0) console.log(`[cron] Auto clock-out complete: ${count} record(s).`);
      } catch (err) {
        console.error("[cron] Auto clock-out failed:", err);
      }
    },
    { timezone: process.env.BUSINESS_TIMEZONE || "Asia/Kolkata" }
  );

  console.log("[cron] Registered: auto clock-out at 7:00 PM (Mon-Sat)");

  // Mark absent at 1:00 AM IST every day. Targets the previous calendar day,
  // so Tuesday 1 AM marks Monday, ..., Sunday 1 AM marks Saturday.
  // Sundays and holidays are skipped inside the service.
  cron.schedule(
    "0 1 * * *",
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
    { timezone: process.env.BUSINESS_TIMEZONE || "Asia/Kolkata" }
  );

  console.log("[cron] Registered: auto-mark absent at 1:00 AM (daily)");
}
