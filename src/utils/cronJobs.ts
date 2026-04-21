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
}
