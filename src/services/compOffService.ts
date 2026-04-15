import CompOff from "../models/CompOff";
import Holiday from "../models/Holiday";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";
import { AuditService } from "./auditService";

// Comp-off expires 60 days after manager approval
const EXPIRY_DAYS = 60;
// Maximum approved+pending comp-offs an employee can hold at once
const ACCRUAL_CAP = 5;
// Max gap (days) between workedDate and dayOffDate
const MAX_REDEMPTION_WINDOW_DAYS = 60;

export class CompOffService {
  // Auto-consume approved comp-offs once their day-off date has passed
  private static async sweepExpired(userId?: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const filter: Record<string, unknown> = {
      status: "approved",
      dayOffDate: { $lt: today },
    };
    if (userId) filter.userId = userId;
    const consumed = await CompOff.find(filter).select("_id userId");
    if (consumed.length === 0) return;
    await CompOff.updateMany(filter, { $set: { status: "used", usedDate: today } });
    for (const rec of consumed) {
      AuditService.log({
        userId: rec.userId.toString(),
        action: "compoff.used",
        module: "leave",
        details: `Comp-off ${rec._id} auto-consumed (day-off date passed)`,
      });
    }

    // Pending requests whose day-off already passed → auto-expire
    const staleFilter: Record<string, unknown> = {
      status: "pending",
      dayOffDate: { $lt: today },
    };
    if (userId) staleFilter.userId = userId;
    const stale = await CompOff.find(staleFilter).select("_id userId");
    if (stale.length > 0) {
      await CompOff.updateMany(staleFilter, { $set: { status: "expired" } });
      for (const rec of stale) {
        AuditService.log({
          userId: rec.userId.toString(),
          action: "compoff.expired",
          module: "leave",
          details: `Pending comp-off ${rec._id} expired (day-off date passed without approval)`,
        });
      }
    }
  }

  static async apply(
    userId: string,
    data: { workedDate: string; dayOffDate: string; hoursWorked: number; reason: string; dayType?: "full" | "half" }
  ) {
    const worked = new Date(data.workedDate);
    if (isNaN(worked.getTime())) throw new ApiError(400, "Invalid worked date.");
    const dayOff = new Date(data.dayOffDate);
    if (isNaN(dayOff.getTime())) throw new ApiError(400, "Invalid day-off date.");

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Worked date must be in the past
    if (worked > today) throw new ApiError(400, "Worked date must be in the past.");

    // Day-off must be strictly in the future
    if (dayOff <= today) throw new ApiError(400, "Day-off date must be in the future.");

    // Day-off must be after worked date
    if (dayOff <= worked) throw new ApiError(400, "Day-off date must be after the worked date.");

    // Day-off must be within redemption window
    const diffDays = Math.ceil((dayOff.getTime() - worked.getTime()) / 86400000);
    if (diffDays > MAX_REDEMPTION_WINDOW_DAYS) {
      throw new ApiError(400, `Day-off must be within ${MAX_REDEMPTION_WINDOW_DAYS} days of worked date.`);
    }

    // Worked date must be a weekend OR a declared holiday
    const dow = worked.getDay();
    const isWeekend = dow === 0 || dow === 6;
    let isHoliday = false;
    if (!isWeekend) {
      const dayStart = new Date(worked); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(worked); dayEnd.setHours(23, 59, 59, 999);
      isHoliday = !!(await Holiday.findOne({ date: { $gte: dayStart, $lte: dayEnd } }));
    }
    if (!isWeekend && !isHoliday) {
      throw new ApiError(400, "Comp-off can only be claimed for work on weekends or declared holidays.");
    }

    // Day-off must be a regular working day (not weekend or holiday)
    const offDow = dayOff.getDay();
    if (offDow === 0 || offDow === 6) {
      throw new ApiError(400, "Day-off date must be a regular working day (not a weekend).");
    }
    const offStart = new Date(dayOff); offStart.setHours(0, 0, 0, 0);
    const offEnd = new Date(dayOff); offEnd.setHours(23, 59, 59, 999);
    const offHoliday = await Holiday.findOne({ date: { $gte: offStart, $lte: offEnd } });
    if (offHoliday) throw new ApiError(400, "Day-off date falls on a declared holiday.");

    // Minimum 4 hours threshold
    if (!data.hoursWorked || data.hoursWorked < 4) {
      throw new ApiError(400, "At least 4 hours of work is required to claim comp-off.");
    }

    // Accrual cap — combined pending + approved cannot exceed ACCRUAL_CAP
    const heldCount = await CompOff.countDocuments({
      userId,
      status: { $in: ["pending", "approved"] },
    });
    if (heldCount >= ACCRUAL_CAP) {
      throw new ApiError(
        400,
        `You already hold ${heldCount} unused comp-offs (max ${ACCRUAL_CAP}). Use existing ones first.`
      );
    }

    // Prevent duplicate claim for the same worked date
    const dayStart = new Date(worked); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(worked); dayEnd.setHours(23, 59, 59, 999);
    const existingWorked = await CompOff.findOne({
      userId,
      workedDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ["pending", "approved", "used"] },
    });
    if (existingWorked) throw new ApiError(400, "A comp-off request already exists for this worked date.");

    // Prevent overlap on same day-off date
    const existingDayOff = await CompOff.findOne({
      userId,
      dayOffDate: { $gte: offStart, $lte: offEnd },
      status: { $in: ["pending", "approved"] },
    });
    if (existingDayOff) throw new ApiError(400, "You already have a comp-off booked for that day-off date.");

    const dayType: "full" | "half" = data.dayType ?? (data.hoursWorked >= 8 ? "full" : "half");

    const created = await CompOff.create({ ...data, userId, dayType });

    AuditService.log({
      userId,
      action: "compoff.applied",
      module: "leave",
      details: `Applied comp-off: worked ${worked.toDateString()} (${data.hoursWorked}h) → day-off ${dayOff.toDateString()}`,
    });

    return created;
  }

  static async getMyRequests(userId: string, query: { page?: number; limit?: number }) {
    await this.sweepExpired(userId);
    const { page, limit, skip } = parsePagination(query);
    const [data, total] = await Promise.all([
      CompOff.find({ userId }).sort("-createdAt").skip(skip).limit(limit),
      CompOff.countDocuments({ userId }),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getBalance(userId: string) {
    await this.sweepExpired(userId);
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const all = await CompOff.find({ userId, workedDate: { $gte: start, $lte: end } });

    const earned = all.filter((c) => c.status === "approved" || c.status === "used").length;
    const used = all.filter((c) => c.status === "used").length;
    const pending = all.filter((c) => c.status === "pending").length;
    const expired = all.filter((c) => c.status === "expired").length;

    // Expiring within 7 days (still approved, unused)
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);
    const expiringSoon = all.filter(
      (c) => c.status === "approved" && c.expiryDate && c.expiryDate <= sevenDays
    ).length;

    return {
      earned,
      used,
      available: earned - used,
      pending,
      expired,
      expiringSoon,
      cap: ACCRUAL_CAP,
    };
  }

  static async getAll(query: { page?: number; limit?: number; status?: string }) {
    await this.sweepExpired();
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const [data, total] = await Promise.all([
      CompOff.find(filter).populate("userId", "name email department").sort("-createdAt").skip(skip).limit(limit),
      CompOff.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async approve(id: string, managerId: string, status: "approved" | "rejected", rejectionComment?: string) {
    const req = await CompOff.findById(id);
    if (!req) throw new ApiError(404, "Comp-off request not found.");
    if (req.status !== "pending") throw new ApiError(400, "Only pending requests can be updated.");
    req.status = status;
    req.approvedBy = managerId as any;
    if (status === "approved") {
      // Expiry is the day-off date itself — if they don't take it, it auto-lapses
      req.expiryDate = req.dayOffDate || new Date(Date.now() + EXPIRY_DAYS * 86400000);
    } else if (rejectionComment) {
      req.rejectionComment = rejectionComment;
    }
    await req.save();

    AuditService.log({
      userId: managerId,
      action: `compoff.${status}`,
      module: "leave",
      details: `Comp-off ${req._id} for user ${req.userId}`,
    });

    return req;
  }

  // Mark a comp-off as used (employee availed it)
  static async markUsed(id: string, userId: string) {
    const req = await CompOff.findById(id);
    if (!req) throw new ApiError(404, "Request not found.");
    if (req.userId.toString() !== userId) throw new ApiError(403, "Not your request.");
    if (req.status !== "approved") throw new ApiError(400, "Only approved comp-offs can be used.");
    if (req.expiryDate && req.expiryDate < new Date()) {
      req.status = "expired";
      await req.save();
      throw new ApiError(400, "This comp-off has expired.");
    }
    req.status = "used";
    req.usedDate = new Date();
    await req.save();

    AuditService.log({
      userId,
      action: "compoff.used",
      module: "leave",
      details: `Comp-off ${req._id} marked as used`,
    });

    return req;
  }

  static async delete(id: string, userId: string) {
    const req = await CompOff.findById(id);
    if (!req) throw new ApiError(404, "Request not found.");
    if (req.userId.toString() !== userId) throw new ApiError(403, "Not your request.");
    if (req.status !== "pending") throw new ApiError(400, "Only pending can be cancelled.");
    await CompOff.findByIdAndDelete(id);

    AuditService.log({
      userId,
      action: "compoff.cancelled",
      module: "leave",
      details: `Comp-off ${id} cancelled by user`,
    });
  }
}
