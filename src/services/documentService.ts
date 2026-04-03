import Document from "../models/Document";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";
import fs from "fs";
import path from "path";

export class DocumentService {
  static async upload(
    userId: string,
    fileData: {
      name: string;
      originalName: string;
      mimeType: string;
      size: number;
      path: string;
      category?: string;
      access?: string;
    }
  ) {
    return Document.create({ ...fileData, uploadedBy: userId });
  }

  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    category?: string;
    access?: string;
  }) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter: Record<string, unknown> = {};

    if (query.category) filter.category = query.category;
    if (query.access) filter.access = query.access;

    const [data, total] = await Promise.all([
      Document.find(filter)
        .populate("uploadedBy", "name email")
        .sort(sort || "-createdAt")
        .skip(skip)
        .limit(limit),
      Document.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string) {
    const doc = await Document.findById(id).populate("uploadedBy", "name email");
    if (!doc) throw new ApiError(404, "Document not found.");
    return doc;
  }

  static async delete(id: string, userId: string, isAdmin: boolean) {
    const doc = await Document.findById(id);
    if (!doc) throw new ApiError(404, "Document not found.");

    if (doc.uploadedBy.toString() !== userId && !isAdmin) {
      throw new ApiError(403, "You can only delete your own documents.");
    }

    // Delete the physical file
    const filePath = path.resolve(doc.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Document.findByIdAndDelete(id);
  }
}
