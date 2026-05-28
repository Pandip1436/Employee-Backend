import User from "../models/User";
import EmployeeProfile from "../models/EmployeeProfile";
import { IUser, PaginatedResult } from "../types";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";
import { StorageService } from "./storageService";

// Attach a signed profilePhotoUrl to each user by looking up their
// EmployeeProfile.profilePhoto R2 key in a single batched query. Users without
// a profile photo just get `profilePhotoUrl: undefined`.
async function attachProfilePhotoUrls<T extends { _id: unknown; toJSON?: () => Record<string, unknown> }>(
  users: T[]
): Promise<Array<Record<string, unknown>>> {
  if (!users.length) return [];
  const userIds = users.map((u) => u._id as IUser["_id"]);
  const profiles = await EmployeeProfile.find({ userId: { $in: userIds } })
    .select("userId profilePhoto")
    .lean();
  const keyByUser = new Map<string, string>();
  for (const p of profiles) {
    if (p.profilePhoto) keyByUser.set(p.userId.toString(), p.profilePhoto);
  }
  return Promise.all(
    users.map(async (u) => {
      const obj = u.toJSON ? u.toJSON() : (u as unknown as Record<string, unknown>);
      const key = keyByUser.get(String(u._id));
      let profilePhotoUrl: string | undefined;
      if (key) {
        try {
          profilePhotoUrl = await StorageService.getSignedDownloadUrl(key, 3600);
        } catch {
          // silent — fall back to no photo
        }
      }
      return { ...obj, profilePhotoUrl };
    })
  );
}

export class UserService {
  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    role?: string;
    isActive?: string;
    search?: string;
    department?: string;
  }): Promise<PaginatedResult<IUser>> {
    const { page, limit, skip, sort } = parsePagination(query);

    const filter: Record<string, unknown> = {};
    if (query.role) {
      // Support comma-separated roles: ?role=admin,manager
      const roles = String(query.role).split(",").map((r) => r.trim()).filter(Boolean);
      filter.role = roles.length > 1 ? { $in: roles } : roles[0];
    }
    if (query.isActive !== undefined) filter.isActive = query.isActive === "true";
    if (query.department) filter.department = String(query.department).trim();
    if (query.search) {
      const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = { $regex: escaped, $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { userId: rx }];
    }

    const [data, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    const enriched = await attachProfilePhotoUrls(data) as unknown as IUser[];

    return {
      data: enriched,
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
    // Clear inactive metadata when reactivating an account
    if (Object.prototype.hasOwnProperty.call(data, "isActive") && data.isActive === true) {
      (data as Record<string, unknown>).inactiveReason = "";
      (data as Record<string, unknown>).relievingDate = "";
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

    const update: Record<string, unknown> = { isActive: action === "activate" };
    if (action === "activate") {
      update.inactiveReason = "";
      update.relievingDate = "";
    }
    const res = await User.updateMany(
      { _id: { $in: targetIds } },
      { $set: update },
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
