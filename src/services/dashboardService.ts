import User from "../models/User";
import Attendance from "../models/Attendance";
import Leave from "../models/Leave";
import WeeklyTimesheet from "../models/WeeklyTimesheet";

export class DashboardService {
  // ── Employee KPIs ──
  static async getEmployeeKpis(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [attendance, todayRecord, leaves, timesheets] = await Promise.all([
      Attendance.countDocuments({ userId, date: { $gte: monthStart }, status: { $in: ["present", "late"] } }),
      Attendance.findOne({ userId, date: today }),
      Leave.find({ userId, status: "approved", startDate: { $gte: monthStart } }),
      WeeklyTimesheet.find({ userId, weekStart: { $gte: monthStart }, status: { $in: ["submitted", "approved"] } }),
    ]);

    const workingDays = Math.max(1, now.getDate());
    const totalHours = timesheets.reduce((s, t) => s + t.totalHours, 0);
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

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

    const [totalEmployees, activeEmployees, newJoiners, leaveStats, todayPresent] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
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
      todayAbsent: activeEmployees - todayPresent,
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
