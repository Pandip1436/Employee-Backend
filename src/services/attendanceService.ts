import Attendance, { IAttendance } from "../models/Attendance";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class AttendanceService {
  /**
   * Returns midnight "today" in the configured business timezone (default IST).
   * This ensures attendance records are bucketed by the user's calendar day,
   * not the server's local-time day (server may be in UTC).
   */
  private static getToday(): Date {
    const tz = process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";
    const now = new Date();
    // Format current instant as YYYY-MM-DD in the business timezone
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const d = Number(parts.find((p) => p.type === "day")?.value);
    // Store as UTC midnight of that calendar date — stable, no DST surprises
    return new Date(Date.UTC(y, m - 1, d));
  }

  private static getOfficeStart(today: Date): Date {
    const [h, m] = (process.env.OFFICE_START_TIME || "09:15").split(":").map(Number);
    const officeStart = new Date(today);
    officeStart.setUTCHours(h, m, 0, 0);
    return officeStart;
  }

  static async clockIn(userId: string, notes?: string) {
    const today = this.getToday();

    const existing = await Attendance.findOne({ userId, date: today });
    if (existing?.clockIn) {
      throw new ApiError(400, "You have already clocked in today.");
    }

    const now = new Date();
    const officeStart = this.getOfficeStart(today);
    const isLate = now > officeStart;
    const status = isLate ? "late" : "present";

    // Calculate late duration in minutes
    let lateByMinutes = 0;
    if (isLate) {
      lateByMinutes = Math.round((now.getTime() - officeStart.getTime()) / 60000);
    }

    const record = existing
      ? existing
      : await Attendance.create({ userId, date: today, clockIn: now, status, notes });

    if (existing) {
      existing.clockIn = now;
      existing.status = status;
      if (notes) existing.notes = notes;
      await existing.save();
    }

    return { ...record.toObject(), isLate, lateByMinutes };
  }

  static async clockOut(userId: string, notes?: string) {
    const today = this.getToday();
    const record = await Attendance.findOne({ userId, date: today });

    if (!record || !record.clockIn) {
      throw new ApiError(400, "You haven't clocked in today.");
    }
    if (record.clockOut) {
      throw new ApiError(400, "You have already clocked out today.");
    }

    const now = new Date();
    record.clockOut = now;
    record.totalHours = parseFloat(
      ((now.getTime() - record.clockIn.getTime()) / 3600000).toFixed(2)
    );

    if (record.totalHours < 4) {
      record.status = "absent";
    } else if (record.totalHours < 8) {
      record.status = "half-day";
    }

    if (notes) record.notes = notes;
    await record.save();
    return record;
  }

  static async getMyToday(userId: string) {
    const today = this.getToday();
    return Attendance.findOne({ userId, date: today });
  }

  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    date?: string;
    userId?: string;
    status?: string;
  }) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter: Record<string, unknown> = {};

    if (query.date) filter.date = new Date(query.date);
    if (query.userId) filter.userId = query.userId;
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      Attendance.find(filter)
        .populate("userId", "name email department role")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Attendance.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getTodayLiveStatus() {
    const today = this.getToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Use a date range to be robust to timezone / precision mismatches
    // (records may have been saved with slightly different "midnight" values)
    const records = await Attendance.find({
      date: { $gte: today, $lt: tomorrow },
    })
      .populate("userId", "name email department role")
      .lean();

    // All active users
    const User = (await import("../models/User")).default;
    const allUsers = await User.find({ isActive: true }).select("name email department role").lean();

    const clockedInMap = new Map(
      records.map((r) => [(r.userId as any)._id.toString(), r])
    );

    const employees = allUsers.map((u) => {
      const record = clockedInMap.get(u._id.toString());
      let liveStatus: "clocked-in" | "clocked-out" | "not-marked" | "late" = "not-marked";

      if (record) {
        if (record.clockIn && !record.clockOut) {
          liveStatus = record.status === "late" ? "late" : "clocked-in";
        } else if (record.clockOut) {
          liveStatus = "clocked-out";
        }
      }

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        department: u.department,
        role: u.role,
        liveStatus,
        clockIn: record?.clockIn || null,
        clockOut: record?.clockOut || null,
        totalHours: record?.totalHours || null,
        status: record?.status || null,
      };
    });

    const summary = {
      total: allUsers.length,
      clockedIn: employees.filter((e) => e.liveStatus === "clocked-in").length,
      late: employees.filter((e) => e.liveStatus === "late").length,
      clockedOut: employees.filter((e) => e.liveStatus === "clocked-out").length,
      notMarked: employees.filter((e) => e.liveStatus === "not-marked").length,
    };

    return { summary, employees };
  }

  static async getMyHistory(
    userId: string,
    query: { page?: number; limit?: number; month?: string }
  ) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { userId };

    if (query.month) {
      const [year, month] = query.month.split("-").map(Number);
      filter.date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
    }

    const [data, total] = await Promise.all([
      Attendance.find(filter).sort("-date").skip(skip).limit(limit),
      Attendance.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getMonthlyReport(month: string, userId?: string) {
    const [year, m] = month.split("-").map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 0); // last day of month

    const filter: Record<string, unknown> = {
      date: { $gte: startDate, $lte: endDate },
    };
    if (userId) filter.userId = userId;

    const records = await Attendance.find(filter)
      .populate("userId", "name email department")
      .sort("date")
      .lean();

    // Group by employee
    const grouped: Record<
      string,
      {
        name: string;
        email: string;
        department: string;
        records: typeof records;
        totalHours: number;
        presentDays: number;
        lateDays: number;
        absentDays: number;
        halfDays: number;
      }
    > = {};

    for (const r of records) {
      const user = r.userId as any;
      const uid = user._id?.toString() || String(r.userId);
      if (!grouped[uid]) {
        grouped[uid] = {
          name: user.name || "Unknown",
          email: user.email || "",
          department: user.department || "",
          records: [],
          totalHours: 0,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0,
          halfDays: 0,
        };
      }
      grouped[uid].records.push(r);
      grouped[uid].totalHours += r.totalHours || 0;
      if (r.status === "present") grouped[uid].presentDays++;
      else if (r.status === "late") grouped[uid].lateDays++;
      else if (r.status === "absent") grouped[uid].absentDays++;
      else if (r.status === "half-day") grouped[uid].halfDays++;
    }

    return {
      month: `${year}-${String(m).padStart(2, "0")}`,
      startDate,
      endDate,
      employees: Object.values(grouped),
      allRecords: records,
    };
  }
}
