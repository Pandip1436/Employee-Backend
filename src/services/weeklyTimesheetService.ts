import WeeklyTimesheet from "../models/WeeklyTimesheet";
import User from "../models/User";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class WeeklyTimesheetService {
  static getWeekRange(date?: string) {
    // weekStart must be timezone-invariant: local-time math produced different
    // stored Dates on servers in different timezones (e.g. IST dev vs UTC prod),
    // defeating the { userId, weekStart } unique index and creating duplicates.
    const src = date ? new Date(date) : new Date();
    const y = src.getUTCFullYear();
    const m = src.getUTCMonth();
    const dayOfMonth = src.getUTCDate();
    const dow = src.getUTCDay(); // 0=Sun..6=Sat
    const mondayUtc = Date.UTC(y, m, dayOfMonth - ((dow + 6) % 7));
    const monday = new Date(mondayUtc);
    const sunday = new Date(mondayUtc);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return { weekStart: monday, weekEnd: sunday };
  }

  static async getOrCreateWeek(userId: string, date?: string) {
    const { weekStart, weekEnd } = this.getWeekRange(date);
    let sheet = await WeeklyTimesheet.findOne({ userId, weekStart })
      .populate("entries.projectId", "name client")
      .populate("userId", "name email")
      .populate("approvedBy", "name email");
    if (!sheet) {
      sheet = await WeeklyTimesheet.create({ userId, weekStart, weekEnd, entries: [], totalHours: 0 });
      sheet = await WeeklyTimesheet.findById(sheet._id)
        .populate("entries.projectId", "name client")
        .populate("userId", "name email");
    }
    return sheet!;
  }

  static async saveEntries(userId: string, weekStart: string, entries: any[]) {
    const { weekStart: ws, weekEnd } = this.getWeekRange(weekStart);
    let sheet = await WeeklyTimesheet.findOne({ userId, weekStart: ws });
    if (!sheet) {
      sheet = await WeeklyTimesheet.create({ userId, weekStart: ws, weekEnd, entries: [], totalHours: 0 });
    }
    if (sheet.status !== "draft" && sheet.status !== "rejected") {
      throw new ApiError(400, "Only draft or rejected timesheets can be edited.");
    }
    sheet.entries = entries;
    sheet.totalHours = entries.reduce((sum, e) => sum + (e.hours || []).reduce((s: number, h: number) => s + h, 0), 0);
    sheet.status = "draft";
    await sheet.save();
    return this.getOrCreateWeek(userId, weekStart);
  }

  static async submit(userId: string, weekId: string) {
    const sheet = await WeeklyTimesheet.findById(weekId);
    if (!sheet) throw new ApiError(404, "Timesheet not found.");
    if (sheet.userId.toString() !== userId) throw new ApiError(403, "Not your timesheet.");
    if (sheet.status !== "draft" && sheet.status !== "rejected") throw new ApiError(400, "Only draft/rejected can be submitted.");
    if (sheet.entries.length === 0) throw new ApiError(400, "Cannot submit empty timesheet.");
    sheet.status = "submitted";
    sheet.submittedAt = new Date();
    await sheet.save();
    return sheet;
  }

  static async approve(weekId: string, managerId: string, status: "approved" | "rejected", comment?: string) {
    const sheet = await WeeklyTimesheet.findById(weekId);
    if (!sheet) throw new ApiError(404, "Timesheet not found.");
    if (sheet.status !== "submitted") throw new ApiError(400, "Only submitted timesheets can be reviewed.");
    sheet.status = status;
    sheet.approvedBy = managerId as any;
    sheet.approvedAt = new Date();
    if (comment) sheet.managerComment = comment;
    await sheet.save();
    return sheet;
  }

  static async deleteOwn(weekId: string, userId: string) {
    const sheet = await WeeklyTimesheet.findById(weekId);
    if (!sheet) throw new ApiError(404, "Timesheet not found.");
    if (sheet.userId.toString() !== userId) throw new ApiError(403, "Not your timesheet.");
    if (sheet.status !== "draft" && sheet.status !== "rejected") {
      throw new ApiError(400, "Only draft or rejected timesheets can be deleted.");
    }
    await WeeklyTimesheet.findByIdAndDelete(weekId);
  }

  static async getById(weekId: string) {
    const sheet = await WeeklyTimesheet.findById(weekId)
      .populate("entries.projectId", "name client")
      .populate("userId", "name email department")
      .populate("approvedBy", "name email");
    if (!sheet) throw new ApiError(404, "Timesheet not found.");
    return sheet;
  }

  static async getMyHistory(userId: string, query: { page?: number; limit?: number; status?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { userId };
    if (query.status) filter.status = query.status;
    const [data, total] = await Promise.all([
      WeeklyTimesheet.find(filter).populate("entries.projectId", "name client").sort("-weekStart").skip(skip).limit(limit),
      WeeklyTimesheet.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getPendingApprovals(query: { page?: number; limit?: number; status?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const validStatuses = ["submitted", "approved", "rejected"];
    const status = query.status && validStatuses.includes(query.status) ? query.status : "submitted";
    const filter = { status };
    const sortField = status === "submitted" ? "-submittedAt" : "-approvedAt";
    const [data, total] = await Promise.all([
      WeeklyTimesheet.find(filter).populate("userId", "name email department").populate("entries.projectId", "name client").populate("approvedBy", "name email").sort(sortField).skip(skip).limit(limit),
      WeeklyTimesheet.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getAllSheets(query: { page?: number; limit?: number; status?: string; userId?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.userId) {
      filter.userId = query.userId;
    } else {
      // Exclude admin users — timesheet export/list is for the workforce only.
      const adminIds = (await User.find({ role: "admin" }).select("_id").lean()).map((u) => u._id);
      if (adminIds.length) filter.userId = { $nin: adminIds };
    }
    const [data, total] = await Promise.all([
      WeeklyTimesheet.find(filter).populate("userId", "name email department").populate("entries.projectId", "name client").populate("approvedBy", "name").sort("-weekStart").skip(skip).limit(limit),
      WeeklyTimesheet.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getProjectSummary(startDate: string, endDate: string) {
    return WeeklyTimesheet.aggregate([
      { $match: { status: { $in: ["submitted", "approved"] }, weekStart: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
      { $unwind: "$entries" },
      { $group: { _id: "$entries.projectId", totalHours: { $sum: { $reduce: { input: "$entries.hours", initialValue: 0, in: { $add: ["$$value", "$$this"] } } } } } },
      { $lookup: { from: "projects", localField: "_id", foreignField: "_id", as: "project" } },
      { $unwind: "$project" },
      { $project: { _id: 0, projectId: "$_id", projectName: "$project.name", client: "$project.client", totalHours: { $round: ["$totalHours", 2] } } },
      { $sort: { totalHours: -1 } },
    ]);
  }

  static async getMissingSubmissions(weekStart: string) {
    const { weekStart: ws, weekEnd: we } = this.getWeekRange(weekStart);
    const User = (await import("../models/User")).default;
    const allUsers = await User.find({ isActive: true, role: { $ne: "admin" } }).select("name email department").lean();
    const submitted = await WeeklyTimesheet.find({ weekStart: { $gte: ws, $lte: we }, status: { $ne: "draft" } }).select("userId").lean();
    const submittedIds = new Set(submitted.map((s) => s.userId.toString()));
    return allUsers.filter((u) => !submittedIds.has(u._id.toString()));
  }

  static async getOvertimeReport(startDate: string, endDate: string, maxHoursPerWeek = 40) {
    const sheets = await WeeklyTimesheet.find({
      status: { $in: ["submitted", "approved"] },
      weekStart: { $gte: new Date(startDate), $lte: new Date(endDate) },
      totalHours: { $gt: maxHoursPerWeek },
    }).populate("userId", "name email department").sort("-totalHours").lean();
    return sheets.map((s) => ({
      employee: s.userId,
      weekStart: s.weekStart,
      totalHours: s.totalHours,
      overtime: parseFloat((s.totalHours - maxHoursPerWeek).toFixed(2)),
    }));
  }

  /**
   * Send Friday reminder emails to employees who haven't submitted this week.
   * Trigger this from a cron job or via the admin endpoint.
   */
  static async sendWeeklyReminders() {
    const { weekStart, weekEnd } = this.getWeekRange();
    const User = (await import("../models/User")).default;
    const { EmailService } = await import("./emailService");

    const allUsers = await User.find({ isActive: true, role: { $ne: "admin" } }).select("name email").lean();
    const submitted = await WeeklyTimesheet.find({ weekStart, status: { $ne: "draft" } }).select("userId").lean();
    const submittedIds = new Set(submitted.map((s) => s.userId.toString()));
    const missing = allUsers.filter((u) => !submittedIds.has(u._id.toString()));

    const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    for (const u of missing) {
      EmailService.sendTimesheetReminder(u.name, u.email, weekLabel);
    }
    return { sent: missing.length, weekLabel };
  }

  /**
   * Per-employee submission compliance over the last N weeks.
   * Compliance % = on-time submissions / weeks
   */
  static async getCompliance(weeks = 8) {
    const User = (await import("../models/User")).default;
    const allUsers = await User.find({ isActive: true, role: { $ne: "admin" } }).select("name email department").lean();

    const now = new Date();
    const weekRanges: { start: Date; end: Date }[] = [];
    for (let i = 0; i < weeks; i++) {
      const ref = new Date(now); ref.setDate(now.getDate() - i * 7);
      const { weekStart, weekEnd } = this.getWeekRange(ref.toISOString());
      weekRanges.push({ start: weekStart, end: weekEnd });
    }
    // Don't include the in-progress current week in the compliance window
    const completedWeeks = weekRanges.slice(1);
    if (completedWeeks.length === 0) return { weeks: 0, employees: [] };

    const sheets = await WeeklyTimesheet.find({
      weekStart: { $in: completedWeeks.map((w) => w.start) },
      status: { $in: ["submitted", "approved"] },
    }).select("userId weekStart status").lean();

    const employees = allUsers.map((u) => {
      const userSheets = sheets.filter((s) => s.userId.toString() === u._id.toString());
      const submittedCount = userSheets.length;
      const compliance = Math.round((submittedCount / completedWeeks.length) * 100);
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        department: u.department,
        submitted: submittedCount,
        total: completedWeeks.length,
        compliance,
      };
    });

    return { weeks: completedWeeks.length, employees };
  }

  static async getEmployeeTimesheetStatus(weekStart?: string, department?: string) {
    const User = (await import("../models/User")).default;
    const { weekStart: ws, weekEnd: we } = this.getWeekRange(weekStart);

    const userFilter: Record<string, unknown> = { isActive: true };
    if (department) userFilter.department = department;

    const [allUsers, sheets] = await Promise.all([
      User.find(userFilter).select("name email department").lean(),
      WeeklyTimesheet.find({ weekStart: { $gte: ws, $lte: we } })
        .select("userId status totalHours submittedAt approvedAt managerComment")
        .populate("approvedBy", "name")
        .lean(),
    ]);

    const sheetMap = new Map(sheets.map((s) => [s.userId.toString(), s]));

    return allUsers.map((u) => {
      const sheet = sheetMap.get(u._id.toString());
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        department: u.department || null,
        status: sheet?.status ?? "not_started",
        totalHours: sheet?.totalHours ?? 0,
        submittedAt: sheet?.submittedAt ?? null,
        approvedAt: sheet?.approvedAt ?? null,
        managerComment: sheet?.managerComment ?? null,
        sheetId: sheet?._id ?? null,
      };
    });
  }

  /**
   * Per-employee entries for a single calendar day. Returns one row per
   * employee that logged hours on that day.
   */
  static async getEmployeeDailyEntries(date: string) {
    const { weekStart } = this.getWeekRange(date);
    // Day index 0..6 (Mon..Sun) — compute from UTC midnight of the target day
    // minus the week's Monday, so this is timezone-stable.
    const target = new Date(date);
    const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
    const dayIdx = Math.round((targetUtc - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    if (dayIdx < 0 || dayIdx > 6) return [];

    const sheets = await WeeklyTimesheet.find({ weekStart })
      .populate("userId", "name email department role")
      .populate("entries.projectId", "name client")
      .lean();

    const rows = [];
    for (const s of sheets) {
      const user = s.userId as unknown as { _id: unknown; name: string; email: string; department?: string; role?: string };
      if (!user || user.role === "admin") continue;
      const dayEntries = (s.entries || [])
        .filter((e) => (e.hours?.[dayIdx] ?? 0) > 0)
        .map((e) => {
          const proj = e.projectId as unknown as { _id: unknown; name?: string; client?: string };
          return {
            projectId: proj?._id ?? null,
            projectName: proj?.name ?? "Unknown",
            client: proj?.client ?? null,
            task: e.task,
            activityType: e.activityType,
            hours: e.hours?.[dayIdx] ?? 0,
            notes: e.notes ?? null,
          };
        });
      if (dayEntries.length === 0) continue;
      rows.push({
        user: { _id: user._id, name: user.name, email: user.email, department: user.department ?? null },
        status: s.status,
        totalHours: dayEntries.reduce((sum, e) => sum + e.hours, 0),
        entries: dayEntries,
      });
    }
    rows.sort((a, b) => a.user.name.localeCompare(b.user.name));
    return rows;
  }

  static async getDashboardStats() {
    const now = new Date();
    const { weekStart } = this.getWeekRange();
    const [submitted, pending, approved, rejected, total] = await Promise.all([
      WeeklyTimesheet.countDocuments({ status: "submitted" }),
      WeeklyTimesheet.countDocuments({ status: "draft", weekStart }),
      WeeklyTimesheet.countDocuments({ status: "approved", weekStart }),
      WeeklyTimesheet.countDocuments({ status: "rejected", weekStart }),
      WeeklyTimesheet.countDocuments({ weekStart }),
    ]);
    return { submitted, pending, approved, rejected, total, weekStart };
  }
}
