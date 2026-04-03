import Attendance from "../models/Attendance";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class AttendanceService {
  private static getToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  static async clockIn(userId: string, notes?: string) {
    const today = this.getToday();

    const existing = await Attendance.findOne({ userId, date: today });
    if (existing?.clockIn) {
      throw new ApiError(400, "You have already clocked in today.");
    }

    const now = new Date();
    const nineAm = new Date(today);
    nineAm.setHours(9, 15, 0, 0);
    const status = now > nineAm ? "late" : "present";

    if (existing) {
      existing.clockIn = now;
      existing.status = status;
      if (notes) existing.notes = notes;
      await existing.save();
      return existing;
    }

    return Attendance.create({
      userId,
      date: today,
      clockIn: now,
      status,
      notes,
    });
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
}
