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
  }): Promise<PaginatedResult<IUser>> {
    const { page, limit, skip, sort } = parsePagination(query);

    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.isActive !== undefined) filter.isActive = query.isActive === "true";

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

  static async update(
    id: string,
    data: Partial<IUser>
  ): Promise<IUser> {
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
}
