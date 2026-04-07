import { Response, NextFunction } from "express";
import { DocumentService } from "../services/documentService";
import { AuditService } from "../services/auditService";
import { AuthRequest } from "../types";
import { ApiError } from "../utils/ApiError";
import path from "path";
import fs from "fs";

export class DocumentController {
  static async upload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "No file uploaded." });
        return;
      }

      const doc = await DocumentService.upload(req.user!._id.toString(), {
        name: req.body.name || req.file.originalname,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        category: req.body.category,
        access: req.body.access,
      });

      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Document uploaded",
        module: "documents",
        details: `${doc.name} (${(doc.size / 1024).toFixed(1)} KB)`,
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, message: "Document uploaded.", data: doc });
    } catch (error) { next(error); }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DocumentService.getAll(req.query as any);
      res.status(200).json({ success: true, message: "Documents fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentService.getById(req.params.id as string);
      res.status(200).json({ success: true, message: "Document fetched.", data: doc });
    } catch (error) { next(error); }
  }

  static async download(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentService.getById(req.params.id as string);

      // Resolve absolute path: if doc.path is already absolute, use it; otherwise resolve from project root
      const filePath = path.isAbsolute(doc.path)
        ? doc.path
        : path.resolve(process.cwd(), doc.path);

      // Check if file exists on disk
      if (!fs.existsSync(filePath)) {
        throw new ApiError(
          404,
          "File not found on server. It may have been removed or storage was reset."
        );
      }

      res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
      res.download(filePath, doc.originalName, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await DocumentService.delete(
        req.params.id as string,
        req.user!._id.toString(),
        req.user!.role === "admin"
      );
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Document deleted",
        module: "documents",
        details: `Document ID: ${req.params.id}`,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, message: "Document deleted." });
    } catch (error) { next(error); }
  }
}
