import User from "../models/User";
import { IUser, PaginatedResult } from "../types";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class UserService {
  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    role?: string;
    isActive?: string;
    search?: string;
  }): Promise<PaginatedResult<IUser>> {
    const { page, limit, skip, sort } = parsePagination(query);

    const filter: Record<string, unknown> = {};
    if (query.role) {
      // Support comma-separated roles: ?role=admin,manager
      const roles = String(query.role).split(",").map((r) => r.trim()).filter(Boolean);
      filter.role = roles.length > 1 ? { $in: roles } : roles[0];
    }
    if (query.isActive !== undefined) filter.isActive = query.isActive === "true";
    if (query.search) {
      const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = { $regex: escaped, $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { userId: rx }];
    }

    const [data, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found.");
    return user;
  }

  static async create(data: {
    name: string;
    email: string;
    userId: string;
    password: string;
    role?: string;
    department?: string;
  }): Promise<IUser> {
    const email = String(data.email || "").trim().toLowerCase();
    const userId = String(data.userId || "").trim().toLowerCase();
    if (!userId) throw new ApiError(400, "User ID is required.");

    const [existingEmail, existingUserId] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ userId }),
    ]);
    if (existingEmail) throw new ApiError(409, "Email already registered.");
    if (existingUserId) throw new ApiError(409, "User ID is already taken.");

    const user = await User.create({ ...data, email, userId });
    return user;
  }

  static async update(
    id: string,
    data: Partial<IUser>
  ): Promise<IUser> {
    // If userId is being changed, guard uniqueness
    if (data.userId) {
      const normalized = String(data.userId).trim().toLowerCase();
      const clash = await User.findOne({ userId: normalized, _id: { $ne: id } });
      if (clash) throw new ApiError(409, "User ID is already taken.");
      data.userId = normalized;
    }
    const user = await User.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    if (!user) throw new ApiError(404, "User not found.");
    return user;
  }

  static async delete(id: string): Promise<void> {
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new ApiError(404, "User not found.");
  }

  static async bulkAction(
    ids: string[],
    action: "activate" | "deactivate" | "delete",
    actingUserId: string,
  ): Promise<{ affected: number }> {
    const targetIds = (ids || []).filter((id) => id && id !== actingUserId);
    if (targetIds.length === 0) return { affected: 0 };

    if (action === "delete") {
      const res = await User.deleteMany({ _id: { $in: targetIds } });
      return { affected: res.deletedCount || 0 };
    }

    const res = await User.updateMany(
      { _id: { $in: targetIds } },
      { $set: { isActive: action === "activate" } },
    );
    return { affected: res.modifiedCount || 0 };
  }

  static async resetPassword(id: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters.");
    }
    const user = await User.findById(id).select("+password");
    if (!user) throw new ApiError(404, "User not found.");
    user.password = newPassword; // pre("save") hook hashes it
    // Invalidate any active session — forces re-login with the new password.
    user.activeToken = undefined;
    await user.save();
  }
}
