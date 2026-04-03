import { Response, NextFunction } from "express";
import { DocumentService } from "../services/documentService";
import { AuthRequest } from "../types";
import path from "path";

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
      const filePath = path.resolve(doc.path);
      res.download(filePath, doc.originalName);
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await DocumentService.delete(
        req.params.id as string,
        req.user!._id.toString(),
        req.user!.role === "admin"
      );
      res.status(200).json({ success: true, message: "Document deleted." });
    } catch (error) { next(error); }
  }
}
