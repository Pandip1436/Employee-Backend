import CompOff from "../models/CompOff";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class CompOffService {
  static async apply(userId: string, data: { workedDate: string; reason: string }) {
    return CompOff.create({ ...data, userId });
  }

  static async getMyRequests(userId: string, query: { page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(query);
    const [data, total] = await Promise.all([
      CompOff.find({ userId }).sort("-createdAt").skip(skip).limit(limit),
      CompOff.countDocuments({ userId }),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getBalance(userId: string) {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const all = await CompOff.find({ userId, workedDate: { $gte: start, $lte: end } });
    const earned = all.filter((c) => c.status === "approved" || c.status === "used").length;
    const used = all.filter((c) => c.status === "used").length;
    const pending = all.filter((c) => c.status === "pending").length;
    return { earned, used, available: earned - used, pending };
  }

  static async getAll(query: { page?: number; limit?: number; status?: string }) {
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
    await req.save();
    return req;
  }

  static async delete(id: string, userId: string) {
    const req = await CompOff.findById(id);
    if (!req) throw new ApiError(404, "Request not found.");
    if (req.userId.toString() !== userId) throw new ApiError(403, "Not your request.");
    if (req.status !== "pending") throw new ApiError(400, "Only pending can be cancelled.");
    await CompOff.findByIdAndDelete(id);
  }
}
