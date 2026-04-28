import { Response, NextFunction } from "express";
import { DocumentService } from "../services/documentService";
import { StorageService } from "../services/storageService";
import { AuditService } from "../services/auditService";
import { NotificationService } from "../services/notificationService";
import { AuthRequest } from "../types";

export class DocumentController {
  static async upload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "No file uploaded." });
        return;
      }

      const key = await StorageService.upload({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: "documents",
      });

      const doc = await DocumentService.upload(req.user!._id.toString(), {
        name: req.body.name || req.file.originalname,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: key,
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

      if ((doc as any).access === "public") {
        NotificationService.notifyAll(
          {
            sender: req.user!._id,
            type: "document",
            title: "New document available",
            message: doc.name,
            link: "/documents",
            entityType: "Document",
            entityId: (doc as any)._id,
          },
          req.user!._id
        ).catch(() => {});
      }

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
      const obj = await StorageService.getObjectStream(doc.path);

      const filename = (doc as any).originalName || (doc as any).name || "download";
      const safeName = encodeURIComponent(filename);
      res.setHeader("Content-Type", obj.contentType || (doc as any).mimeType || "application/octet-stream");
      if (obj.contentLength != null) res.setHeader("Content-Length", String(obj.contentLength));
      res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${safeName}`);

      obj.body.on("error", (err) => next(err));
      obj.body.pipe(res);
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
