import WfhRequest from "../models/WfhRequest";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class WfhService {
  static async apply(userId: string, data: { date: string; reason: string }) {
    return WfhRequest.create({ ...data, userId });
  }

  static async getMyRequests(userId: string, query: { page?: number; limit?: number }) {
    const { page, limit, skip } = parsePagination(query);
    const [data, total] = await Promise.all([
      WfhRequest.find({ userId }).sort("-createdAt").skip(skip).limit(limit),
      WfhRequest.countDocuments({ userId }),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getAll(query: { page?: number; limit?: number; status?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const [data, total] = await Promise.all([
      WfhRequest.find(filter).populate("userId", "name email department").sort("-createdAt").skip(skip).limit(limit),
      WfhRequest.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async approve(id: string, managerId: string, status: "approved" | "rejected") {
    const req = await WfhRequest.findById(id);
    if (!req) throw new ApiError(404, "WFH request not found.");
    if (req.status !== "pending") throw new ApiError(400, "Only pending requests can be updated.");
    req.status = status;
    req.approvedBy = managerId as any;
    await req.save();
    return req;
  }

  static async delete(id: string, userId: string) {
    const req = await WfhRequest.findById(id);
    if (!req) throw new ApiError(404, "Request not found.");
    if (req.userId.toString() !== userId) throw new ApiError(403, "Not your request.");
    if (req.status !== "pending") throw new ApiError(400, "Only pending requests can be cancelled.");
    await WfhRequest.findByIdAndDelete(id);
  }
}
