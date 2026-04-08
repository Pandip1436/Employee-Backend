import CompOff from "../models/CompOff";
import Holiday from "../models/Holiday";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";
import { AuditService } from "./auditService";

// Comp-off expires 60 days after manager approval
const EXPIRY_DAYS = 60;
// Maximum approved+pending comp-offs an employee can hold at once
const ACCRUAL_CAP = 5;

export class CompOffService {
  // Auto-mark expired records — call before reads that need fresh state
  private static async sweepExpired(userId?: string) {
    const filter: Record<string, unknown> = {
      status: "approved",
      expiryDate: { $lt: new Date() },
    };
    if (userId) filter.userId = userId;
    const expired = await CompOff.find(filter).select("_id userId");
    if (expired.length === 0) return;
    await CompOff.updateMany(filter, { $set: { status: "expired" } });
    // Audit (one entry per expired record)
    for (const rec of expired) {
      AuditService.log({
        userId: rec.userId.toString(),
        action: "compoff.expired",
        module: "leave",
        details: `Comp-off ${rec._id} auto-expired`,
      });
    }
  }

  static async apply(
    userId: string,
    data: { workedDate: string; hoursWorked: number; reason: string }
  ) {
    const worked = new Date(data.workedDate);
    if (isNaN(worked.getTime())) throw new ApiError(400, "Invalid worked date.");

    // Must be a weekend OR a declared holiday
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

    // Prevent duplicate claim for the same date
    const dayStart = new Date(worked); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(worked); dayEnd.setHours(23, 59, 59, 999);
    const existing = await CompOff.findOne({
      userId,
      workedDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ["pending", "approved", "used"] },
    });
    if (existing) throw new ApiError(400, "A comp-off request already exists for this date.");

    const created = await CompOff.create({ ...data, userId });

    AuditService.log({
      userId,
      action: "compoff.applied",
      module: "leave",
      details: `Applied comp-off for ${worked.toDateString()} (${data.hoursWorked}h)`,
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

  static async approve(id: string, managerId: string, status: "approved" | "rejected") {
    const req = await CompOff.findById(id);
    if (!req) throw new ApiError(404, "Comp-off request not found.");
    if (req.status !== "pending") throw new ApiError(400, "Only pending requests can be updated.");
    req.status = status;
    req.approvedBy = managerId as any;
    if (status === "approved") {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + EXPIRY_DAYS);
      req.expiryDate = expiry;
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
