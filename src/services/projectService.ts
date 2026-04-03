import Project from "../models/Project";
import { IProject, PaginatedResult } from "../types";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class ProjectService {
  static async create(
    data: Partial<IProject>,
    userId: string
  ): Promise<IProject> {
    const project = await Project.create({ ...data, createdBy: userId });
    return project;
  }

  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    status?: string;
  }): Promise<PaginatedResult<IProject>> {
    const { page, limit, skip, sort } = parsePagination(query);

    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      Project.find(filter)
        .populate("assignedUsers", "name email role")
        .populate("createdBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string): Promise<IProject> {
    const project = await Project.findById(id)
      .populate("assignedUsers", "name email role")
      .populate("createdBy", "name email");
    if (!project) throw new ApiError(404, "Project not found.");
    return project;
  }

  static async update(
    id: string,
    data: Partial<IProject>
  ): Promise<IProject> {
    const project = await Project.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).populate("assignedUsers", "name email role");
    if (!project) throw new ApiError(404, "Project not found.");
    return project;
  }

  static async delete(id: string): Promise<void> {
    const project = await Project.findByIdAndDelete(id);
    if (!project) throw new ApiError(404, "Project not found.");
  }
}
