import Project from "../models/Project";
import { IProject, PaginatedResult } from "../types";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";
import { attachProfilePhotoUrls } from "./userService";

// Attach a signed profilePhotoUrl to each member of a project's assignedUsers
// (project.assignedUsers come from .populate() and don't include the photo URL
// by default — EmployeeProfile holds the R2 key for the photo).
async function withMemberPhotos(project: any): Promise<any> {
  if (!project) return project;
  const obj = typeof project.toObject === "function" ? project.toObject() : project;
  if (Array.isArray(obj.assignedUsers) && obj.assignedUsers.length) {
    obj.assignedUsers = await attachProfilePhotoUrls(obj.assignedUsers);
  }
  return obj;
}

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

    const [rawData, total] = await Promise.all([
      Project.find(filter)
        .populate("assignedUsers", "name email role")
        .populate("createdBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    const data = await Promise.all(rawData.map(withMemberPhotos));

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
    return await withMemberPhotos(project);
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
    return await withMemberPhotos(project);
  }

  static async delete(id: string): Promise<void> {
    const project = await Project.findByIdAndDelete(id);
    if (!project) throw new ApiError(404, "Project not found.");
  }
}
