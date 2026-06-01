import User from "../models/User";
import Attendance from "../models/Attendance";
import Leave from "../models/Leave";
import Holiday from "../models/Holiday";
import WeeklyTimesheet from "../models/WeeklyTimesheet";
import CompanySettings from "../models/CompanySettings";
import { AttendanceService, isWorkingDow } from "./attendanceService";
import { attachProfilePhotoUrls } from "./userService";

/** Compute today's attendance buckets for the active non-admin workforce,
 *  overlaying approved leaves so employees on leave surface as on-leave even
 *  when the auto-mark cron hasn't created a row yet for that day. */
async function computeTodayBuckets(date: Date): Promise<{
  present: number;
  absent: number;
  onLeave: number;
  notMarked: number;
  activeWorkforce: number;
}> {
  const [users, attendance, leaves] = await Promise.all([
    User.find({ isActive: true, role: { $ne: "admin" } }).select("_id").lean(),
    Attendance.find({ date }).select("userId status").lean(),
    Leave.find({
      status: "approved",
      startDate: { $lte: date },
      endDate: { $gte: date },
    }).select("userId").lean(),
  ]);

  const statusByUser = new Map<string, string>(
    attendance.map((a) => [a.userId.toString(), a.status])
  );
  const onLeaveUserIds = new Set(leaves.map((l) => l.userId.toString()));

  let present = 0, absent = 0, onLeave = 0, notMarked = 0;
  for (const u of users) {
    const uid = u._id.toString();
    const status = statusByUser.get(uid);
    const hasApprovedLeave = onLeaveUserIds.has(uid);

    if (status === "present" || status === "late" || status === "half-day") {
      // Real attendance wins over a leave on the books.
      present++;
    } else if (status === "on-leave" || hasApprovedLeave) {
      onLeave++;
    } else if (status === "absent") {
      absent++;
    } else {
      notMarked++;
    }
  }

  return { present, absent, onLeave, notMarked, activeWorkforce: users.length };
}

export class DashboardService {
  // ── Employee KPIs ──
  static async getEmployeeKpis(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Match the bucketing used when attendance rows are written (UTC midnight
    // of the business-timezone calendar day), not the server's local midnight.
    const today = AttendanceService.getToday();

    const [attendance, todayRecord, leaves, monthAttendance, holidays, settings] = await Promise.all([
      Attendance.countDocuments({ userId, date: { $gte: monthStart }, status: { $in: ["present", "late"] } }),
      Attendance.findOne({ userId, date: today }),
      Leave.find({ userId, status: "approved", startDate: { $gte: monthStart } }),
      Attendance.find({ userId, date: { $gte: monthStart } }).select("totalHours"),
      Holiday.find({ date: { $gte: monthStart, $lte: today } }).select("date"),
      CompanySettings.findOne().select("workingDays").lean(),
    ]);

    // Working days = configured working days from start of month to today, minus declared holidays
    const cfgWorkingDays = (settings as any)?.workingDays as string[] | undefined;
    let workingDays = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (isWorkingDow(dow, cfgWorkingDays)) workingDays++;
    }
    const holidayWorkdays = holidays.filter((h) =>
      isWorkingDow(new Date(h.date).getDay(), cfgWorkingDays)
    ).length;
    workingDays = Math.max(1, workingDays - holidayWorkdays);
    const totalHours = monthAttendance.reduce((s, a) => s + (a.totalHours || 0), 0);
    const totalLeaveDays = leaves.reduce((s, l) => s + l.days, 0);

    return {
      attendanceDays: attendance,
      attendancePercent: Math.round((attendance / workingDays) * 100),
      totalHoursThisMonth: parseFloat(totalHours.toFixed(1)),
      leaveDaysTaken: totalLeaveDays,
      todayStatus: todayRecord ? { clockIn: todayRecord.clockIn, clockOut: todayRecord.clockOut, status: todayRecord.status, totalHours: todayRecord.totalHours } : null,
      pendingTimesheets: await WeeklyTimesheet.countDocuments({ userId, status: "draft" }),
    };
  }

  // ── Manager Stats ──
  static async getManagerStats() {
    const today = AttendanceService.getToday();

    const [pendingLeaves, pendingTimesheets, buckets] = await Promise.all([
      Leave.countDocuments({ status: "pending" }),
      WeeklyTimesheet.countDocuments({ status: "submitted" }),
      computeTodayBuckets(today),
    ]);

    return {
      pendingLeaves,
      pendingTimesheets,
      totalEmployees: buckets.activeWorkforce,
      todayPresent: buckets.present,
      todayAbsent: buckets.absent,
      todayOnLeave: buckets.onLeave,
      todayNotMarked: buckets.notMarked,
    };
  }

  // ── HR Stats ──
  static async getHrStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // HR dashboard counts the workforce only — admins are staff of the system, not part of the workforce metrics.
    const nonAdminFilter = { role: { $ne: "admin" } } as const;
    const today = AttendanceService.getToday();
    const [totalEmployees, activeEmployees, newJoiners, leaveStats, buckets] = await Promise.all([
      User.countDocuments(nonAdminFilter),
      User.countDocuments({ isActive: true, ...nonAdminFilter }),
      User.find({ createdAt: { $gte: monthStart }, isActive: true, ...nonAdminFilter }).select("name email department createdAt").sort("-createdAt").limit(10).lean(),
      Leave.aggregate([
        { $match: { status: "approved", startDate: { $gte: yearStart } } },
        { $group: { _id: "$type", totalDays: { $sum: "$days" }, count: { $sum: 1 } } },
      ]),
      computeTodayBuckets(today),
    ]);

    // Enrich new-joiner list with signed photo URLs in one batch.
    const newJoinersWithPhotos = await attachProfilePhotoUrls(newJoiners);

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
      newJoinersThisMonth: newJoinersWithPhotos,
      leaveStats,
      todayPresent: buckets.present,
      todayAbsent: buckets.absent,
      todayOnLeave: buckets.onLeave,
      todayNotMarked: buckets.notMarked,
      attritionRate: totalEmployees > 0 ? parseFloat(((totalEmployees - activeEmployees) / totalEmployees * 100).toFixed(1)) : 0,
    };
  }

  // ── Upcoming Birthdays / Anniversaries (from profile data) ──
  static async getUpcomingEvents() {
    // Use join dates as anniversaries
    const now = new Date();
    const users = await User.find({ isActive: true, role: { $ne: "admin" } }).select("name email department createdAt").lean();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 14);

    const baseList = users.filter((u) => {
      const joinDate = new Date(u.createdAt);
      const thisYearAnniv = new Date(now.getFullYear(), joinDate.getMonth(), joinDate.getDate());
      return thisYearAnniv >= today && thisYearAnniv <= nextWeek && joinDate.getFullYear() < now.getFullYear();
    });
    // Attach signed photo URLs in a single batch before composing the response.
    const withPhotos = await attachProfilePhotoUrls(baseList);
    const anniversaries = withPhotos.map((u) => {
      const joinDate = new Date((u as { createdAt: string | Date }).createdAt);
      return { ...u, years: now.getFullYear() - joinDate.getFullYear(), eventDate: new Date(now.getFullYear(), joinDate.getMonth(), joinDate.getDate()) };
    });

    return { anniversaries };
  }

  // ── Pending Approvals (combined) ──
  static async getPendingApprovals() {
    const [leaves, timesheets] = await Promise.all([
      Leave.find({ status: "pending" }).populate("userId", "name email").sort("-createdAt").limit(5).lean(),
      WeeklyTimesheet.find({ status: "submitted" }).populate("userId", "name email").sort("-submittedAt").limit(5).lean(),
    ]);

    // Collect unique users across both lists and enrich with signed photo URLs in one batch.
    const usersMap = new Map<string, unknown>();
    for (const r of [...leaves, ...timesheets]) {
      const u = r.userId as { _id?: unknown } | null | undefined;
      const id = u?._id;
      if (u && id) usersMap.set(String(id), u);
    }
    const enriched = await attachProfilePhotoUrls(
      Array.from(usersMap.values()) as Array<{ _id: unknown; toJSON?: () => Record<string, unknown> }>,
    );
    const photoByUserId = new Map<string, string | undefined>();
    for (const u of enriched) photoByUserId.set(String(u._id), u.profilePhotoUrl as string | undefined);

    const withPhoto = (u: unknown) => {
      const o = u as { _id?: unknown } & Record<string, unknown>;
      if (o && typeof o === "object" && o._id) {
        return { ...o, profilePhotoUrl: photoByUserId.get(String(o._id)) };
      }
      return u;
    };

    return {
      leaves: leaves.map((l) => ({ _id: l._id, type: "leave", employee: withPhoto(l.userId), leaveType: l.type, days: l.days, startDate: l.startDate, createdAt: l.createdAt })),
      timesheets: timesheets.map((t) => ({ _id: t._id, type: "timesheet", employee: withPhoto(t.userId), weekStart: t.weekStart, totalHours: t.totalHours, submittedAt: t.submittedAt })),
    };
  }

  // ── Team Leave Calendar ──
  static async getTeamLeaveCalendar(month: string) {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0);

    const leaves = await Leave.find({
      status: "approved",
      startDate: { $lte: end },
      endDate: { $gte: start },
    }).populate("userId", "name department").lean();

    return leaves.map((l) => ({
      employee: (l.userId as any)?.name || "Unknown",
      department: (l.userId as any)?.department || "",
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      days: l.days,
    }));
  }
}
