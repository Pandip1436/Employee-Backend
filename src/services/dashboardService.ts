import User from "../models/User";
import Attendance from "../models/Attendance";
import Leave from "../models/Leave";
import Holiday from "../models/Holiday";
import WeeklyTimesheet from "../models/WeeklyTimesheet";

export class DashboardService {
  // ── Employee KPIs ──
  static async getEmployeeKpis(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [attendance, todayRecord, leaves, monthAttendance, holidays] = await Promise.all([
      Attendance.countDocuments({ userId, date: { $gte: monthStart }, status: { $in: ["present", "late"] } }),
      Attendance.findOne({ userId, date: today }),
      Leave.find({ userId, status: "approved", startDate: { $gte: monthStart } }),
      Attendance.find({ userId, date: { $gte: monthStart } }).select("totalHours"),
      Holiday.find({ date: { $gte: monthStart, $lte: today } }).select("date"),
    ]);

    // Working days = Mon–Fri from start of month to today, minus declared holidays
    let workingDays = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (dow !== 0 && dow !== 6) workingDays++;
    }
    const holidayWeekdays = holidays.filter((h) => {
      const dow = new Date(h.date).getDay();
      return dow !== 0 && dow !== 6;
    }).length;
    workingDays = Math.max(1, workingDays - holidayWeekdays);
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
    const now = new Date();

    const [pendingLeaves, pendingTimesheets, totalEmployees, todayPresent] = await Promise.all([
      Leave.countDocuments({ status: "pending" }),
      WeeklyTimesheet.countDocuments({ status: "submitted" }),
      User.countDocuments({ isActive: true }),
      Attendance.countDocuments({ date: new Date(now.getFullYear(), now.getMonth(), now.getDate()), status: { $in: ["present", "late"] } }),
    ]);

    return { pendingLeaves, pendingTimesheets, totalEmployees, todayPresent, todayAbsent: totalEmployees - todayPresent };
  }

  // ── HR Stats ──
  static async getHrStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Admins are not required to mark attendance — exclude them from attendance totals
    const nonAdminFilter = { role: { $ne: "admin" } } as const;
    const [totalEmployees, activeEmployees, trackedEmployees, newJoiners, leaveStats, todayPresent] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true, ...nonAdminFilter }),
      User.find({ createdAt: { $gte: monthStart }, isActive: true }).select("name email department createdAt").sort("-createdAt").limit(10).lean(),
      Leave.aggregate([
        { $match: { status: "approved", startDate: { $gte: yearStart } } },
        { $group: { _id: "$type", totalDays: { $sum: "$days" }, count: { $sum: 1 } } },
      ]),
      Attendance.countDocuments({ date: new Date(now.getFullYear(), now.getMonth(), now.getDate()), status: { $in: ["present", "late"] } }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
      newJoinersThisMonth: newJoiners,
      leaveStats,
      todayPresent,
      todayAbsent: Math.max(0, trackedEmployees - todayPresent),
      attritionRate: totalEmployees > 0 ? parseFloat(((totalEmployees - activeEmployees) / totalEmployees * 100).toFixed(1)) : 0,
    };
  }

  // ── Upcoming Birthdays / Anniversaries (from profile data) ──
  static async getUpcomingEvents() {
    // Use join dates as anniversaries
    const now = new Date();
    const users = await User.find({ isActive: true }).select("name email department createdAt").lean();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 14);

    const anniversaries = users.filter((u) => {
      const joinDate = new Date(u.createdAt);
      const thisYearAnniv = new Date(now.getFullYear(), joinDate.getMonth(), joinDate.getDate());
      return thisYearAnniv >= today && thisYearAnniv <= nextWeek && joinDate.getFullYear() < now.getFullYear();
    }).map((u) => {
      const joinDate = new Date(u.createdAt);
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
    return {
      leaves: leaves.map((l) => ({ _id: l._id, type: "leave", employee: l.userId, leaveType: l.type, days: l.days, startDate: l.startDate, createdAt: l.createdAt })),
      timesheets: timesheets.map((t) => ({ _id: t._id, type: "timesheet", employee: t.userId, weekStart: t.weekStart, totalHours: t.totalHours, submittedAt: t.submittedAt })),
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
