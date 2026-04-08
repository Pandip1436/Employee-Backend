import Leave from "../models/Leave";
import CompanySettings from "../models/CompanySettings";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

const DEFAULT_LEAVE_POLICY = {
  casual: { total: 12 },
  sick: { total: 10 },
  earned: { total: 15 },
};

async function getActiveLeavePolicy() {
  try {
    const s = await CompanySettings.findOne().lean();
    const lp = (s as any)?.leavePolicy;
    return {
      casual: { total: lp?.casual?.total ?? DEFAULT_LEAVE_POLICY.casual.total },
      sick: { total: lp?.sick?.total ?? DEFAULT_LEAVE_POLICY.sick.total },
      earned: { total: lp?.earned?.total ?? DEFAULT_LEAVE_POLICY.earned.total },
    };
  } catch {
    return DEFAULT_LEAVE_POLICY;
  }
}

export class LeaveService {
  static async apply(userId: string, data: {
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = end.getTime() - start.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (days < 1) throw new ApiError(400, "End date must be after start date.");

    return Leave.create({ ...data, userId, days });
  }

  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    status?: string;
    userId?: string;
    type?: string;
  }) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.userId) filter.userId = query.userId;
    if (query.type) filter.type = query.type;

    const [data, total] = await Promise.all([
      Leave.find(filter)
        .populate("userId", "name email department role")
        .populate("approvedBy", "name email")
        .sort(sort || "-createdAt")
        .skip(skip)
        .limit(limit),
      Leave.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getMyLeaves(
    userId: string,
    query: { page?: number; limit?: number; status?: string }
  ) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { userId };
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      Leave.find(filter).sort("-createdAt").skip(skip).limit(limit),
      Leave.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getBalance(userId: string) {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const approved = await Leave.find({
      userId,
      status: "approved",
      startDate: { $gte: startOfYear, $lte: endOfYear },
    });

    const used = { casual: 0, sick: 0, earned: 0, unpaid: 0 };
    for (const l of approved) {
      used[l.type as keyof typeof used] += l.days;
    }

    const policy = await getActiveLeavePolicy();
    return {
      casual: {
        total: policy.casual.total,
        used: used.casual,
        remaining: policy.casual.total - used.casual,
      },
      sick: {
        total: policy.sick.total,
        used: used.sick,
        remaining: policy.sick.total - used.sick,
      },
      earned: {
        total: policy.earned.total,
        used: used.earned,
        remaining: policy.earned.total - used.earned,
      },
    };
  }

  static async approve(
    leaveId: string,
    managerId: string,
    status: "approved" | "rejected",
    rejectionComment?: string
  ) {
    const leave = await Leave.findById(leaveId);
    if (!leave) throw new ApiError(404, "Leave request not found.");
    if (leave.status !== "pending") {
      throw new ApiError(400, "Only pending leaves can be approved or rejected.");
    }

    leave.status = status;
    leave.approvedBy = managerId as any;
    if (status === "rejected" && rejectionComment) {
      leave.rejectionComment = rejectionComment;
    }
    await leave.save();
    return leave;
  }

  static async delete(leaveId: string, userId: string) {
    const leave = await Leave.findById(leaveId);
    if (!leave) throw new ApiError(404, "Leave request not found.");
    if (leave.userId.toString() !== userId) {
      throw new ApiError(403, "You can only delete your own leave requests.");
    }
    if (leave.status !== "pending") {
      throw new ApiError(400, "Only pending leaves can be cancelled.");
    }
    await Leave.findByIdAndDelete(leaveId);
  }
}
