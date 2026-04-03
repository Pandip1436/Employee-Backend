import Timesheet from "../models/Timesheet";
import { ITimesheet, PaginatedResult } from "../types";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class TimesheetService {
  static async create(
    data: Partial<ITimesheet>,
    userId: string
  ): Promise<ITimesheet> {
    const timesheet = await Timesheet.create({ ...data, userId });
    return timesheet;
  }

  static async getAll(
    query: {
      page?: number;
      limit?: number;
      sort?: string;
      status?: string;
      projectId?: string;
      startDate?: string;
      endDate?: string;
    },
    userId?: string,
    isManager = false
  ): Promise<PaginatedResult<ITimesheet>> {
    const { page, limit, skip, sort } = parsePagination(query);

    const filter: Record<string, unknown> = {};
    if (userId && !isManager) filter.userId = userId;
    if (query.status) filter.status = query.status;
    if (query.projectId) filter.projectId = query.projectId;

    if (query.startDate || query.endDate) {
      filter.date = {} as Record<string, Date>;
      if (query.startDate)
        (filter.date as Record<string, Date>).$gte = new Date(query.startDate);
      if (query.endDate)
        (filter.date as Record<string, Date>).$lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      Timesheet.find(filter)
        .populate("userId", "name email")
        .populate("projectId", "name client")
        .populate("approvedBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Timesheet.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string): Promise<ITimesheet> {
    const timesheet = await Timesheet.findById(id)
      .populate("userId", "name email")
      .populate("projectId", "name client")
      .populate("approvedBy", "name email");
    if (!timesheet) throw new ApiError(404, "Timesheet entry not found.");
    return timesheet;
  }

  static async update(
    id: string,
    data: Partial<ITimesheet>,
    userId: string
  ): Promise<ITimesheet> {
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new ApiError(404, "Timesheet entry not found.");

    if (timesheet.userId.toString() !== userId) {
      throw new ApiError(403, "You can only edit your own timesheets.");
    }

    if (timesheet.status !== "draft") {
      throw new ApiError(400, "Only draft timesheets can be edited.");
    }

    Object.assign(timesheet, data);
    await timesheet.save();
    return timesheet;
  }

  static async delete(id: string, userId: string): Promise<void> {
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new ApiError(404, "Timesheet entry not found.");

    if (timesheet.userId.toString() !== userId) {
      throw new ApiError(403, "You can only delete your own timesheets.");
    }

    if (timesheet.status !== "draft") {
      throw new ApiError(400, "Only draft timesheets can be deleted.");
    }

    await Timesheet.findByIdAndDelete(id);
  }

  static async submit(id: string, userId: string): Promise<ITimesheet> {
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new ApiError(404, "Timesheet entry not found.");

    if (timesheet.userId.toString() !== userId) {
      throw new ApiError(403, "You can only submit your own timesheets.");
    }

    if (timesheet.status !== "draft") {
      throw new ApiError(400, "Only draft timesheets can be submitted.");
    }

    timesheet.status = "submitted";
    await timesheet.save();
    return timesheet;
  }

  static async approve(
    id: string,
    managerId: string,
    status: "approved" | "rejected",
    rejectionComment?: string
  ): Promise<ITimesheet> {
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new ApiError(404, "Timesheet entry not found.");

    if (timesheet.status !== "submitted") {
      throw new ApiError(400, "Only submitted timesheets can be approved or rejected.");
    }

    timesheet.status = status;
    timesheet.approvedBy = managerId as any;
    if (status === "rejected" && rejectionComment) {
      timesheet.rejectionComment = rejectionComment;
    }

    await timesheet.save();
    return timesheet;
  }
}
