import DailyUpdate from "../models/DailyUpdate";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class DailyUpdateService {
  static async create(userId: string, data: {
    date: string;
    tasks: string;
    links?: string;
    status: string;
    proof?: string;
    planForTomorrow: string;
  }) {
    const dateObj = new Date(data.date);
    dateObj.setHours(0, 0, 0, 0);

    // Check if update already exists for this date
    const existing = await DailyUpdate.findOne({ userId, date: dateObj });
    if (existing) {
      throw new ApiError(400, "You have already submitted an update for this date. Use edit instead.");
    }

    const update = await DailyUpdate.create({ ...data, date: dateObj, userId });
    return DailyUpdate.findById(update._id).populate("userId", "name email department");
  }

  static async update(id: string, userId: string, data: {
    tasks?: string;
    links?: string;
    status?: string;
    proof?: string;
    planForTomorrow?: string;
  }) {
    const update = await DailyUpdate.findById(id);
    if (!update) throw new ApiError(404, "Update not found.");
    if (update.userId.toString() !== userId) throw new ApiError(403, "You can only edit your own updates.");

    Object.assign(update, data);
    await update.save();
    return DailyUpdate.findById(id).populate("userId", "name email department");
  }

  static async delete(id: string, userId: string) {
    const update = await DailyUpdate.findById(id);
    if (!update) throw new ApiError(404, "Update not found.");
    if (update.userId.toString() !== userId) throw new ApiError(403, "You can only delete your own updates.");
    await DailyUpdate.findByIdAndDelete(id);
  }

  static async getMyUpdates(userId: string, query: { page?: number; limit?: number; month?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { userId };

    if (query.month) {
      const [y, m] = query.month.split("-").map(Number);
      filter.date = {
        $gte: new Date(y, m - 1, 1),
        $lt: new Date(y, m, 1),
      };
    }

    const [data, total] = await Promise.all([
      DailyUpdate.find(filter).populate("userId", "name email department").populate("reviewedBy", "name email").sort("-date").skip(skip).limit(limit),
      DailyUpdate.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getTeamUpdates(query: { page?: number; limit?: number; date?: string; userId?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {};

    if (query.date) {
      const d = new Date(query.date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    }

    if (query.userId) filter.userId = query.userId;

    const [data, total] = await Promise.all([
      DailyUpdate.find(filter).populate("userId", "name email department").populate("reviewedBy", "name email").sort("-date").skip(skip).limit(limit),
      DailyUpdate.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  static async getById(id: string) {
    const update = await DailyUpdate.findById(id)
      .populate("userId", "name email department")
      .populate("reviewedBy", "name email");
    if (!update) throw new ApiError(404, "Update not found.");
    return update;
  }

  static async review(id: string, managerId: string, data: {
    reviewStatus: "reviewed" | "needs-improvement";
    reviewComment?: string;
  }) {
    const update = await DailyUpdate.findById(id);
    if (!update) throw new ApiError(404, "Update not found.");

    update.reviewedBy = managerId as any;
    update.reviewedAt = new Date();
    update.reviewStatus = data.reviewStatus;
    if (data.reviewComment) update.reviewComment = data.reviewComment;
    else update.reviewComment = undefined;

    await update.save();
    return DailyUpdate.findById(id)
      .populate("userId", "name email department")
      .populate("reviewedBy", "name email");
  }
}
