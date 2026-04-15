import { Response, NextFunction } from "express";
import Announcement from "../models/Announcement";
import { AuthRequest } from "../types";
import { parsePagination } from "../utils/helpers";
import { NotificationService } from "../services/notificationService";

export class AnnouncementController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req.query as any);
      const filter: Record<string, unknown> = { isPublished: true };
      if (req.query.category && req.query.category !== "all") filter.category = req.query.category;
      if (req.query.search) filter.title = { $regex: req.query.search, $options: "i" };
      const [data, total] = await Promise.all([
        Announcement.find(filter).populate("author", "name email").sort("-isPinned -createdAt").skip(skip).limit(limit),
        Announcement.countDocuments(filter),
      ]);
      res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (e) { next(e); }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ann = await Announcement.findById(req.params.id as string)
        .populate("author", "name email")
        .populate("comments.userId", "name email");
      if (!ann) { res.status(404).json({ success: false, message: "Not found." }); return; }
      res.json({ success: true, data: ann });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ann = await Announcement.create({ ...req.body, author: req.user!._id });
      if (ann.isPublished) {
        NotificationService.notifyAll(
          {
            sender: req.user!._id,
            type: "announcement",
            title: "New announcement",
            message: ann.title,
            link: `/announcements/${ann._id}`,
            entityType: "Announcement",
            entityId: ann._id,
          },
          req.user!._id
        ).catch(() => {});
      }
      res.status(201).json({ success: true, data: ann });
    } catch (e) { next(e); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ann = await Announcement.findByIdAndUpdate(req.params.id as string, req.body, { new: true });
      res.json({ success: true, data: ann });
    } catch (e) { next(e); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await Announcement.findByIdAndDelete(req.params.id as string);
      res.json({ success: true, message: "Deleted." });
    } catch (e) { next(e); }
  }

  static async react(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.body; // "like" | "love" | "celebrate"
      const ann = await Announcement.findById(req.params.id as string);
      if (!ann) { res.status(404).json({ success: false, message: "Not found." }); return; }
      const userId = req.user!._id;
      const field = `reactions.${type}` as any;
      const existing = (ann.reactions as any)[type] as any[];
      if (existing.some((id: any) => id.toString() === userId.toString())) {
        await Announcement.findByIdAndUpdate(ann._id, { $pull: { [field]: userId } });
      } else {
        await Announcement.findByIdAndUpdate(ann._id, { $addToSet: { [field]: userId } });
      }
      const updated = await Announcement.findById(ann._id);
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  static async addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ann = await Announcement.findByIdAndUpdate(
        req.params.id as string,
        { $push: { comments: { userId: req.user!._id, text: req.body.text } } },
        { new: true }
      ).populate("comments.userId", "name email");
      res.json({ success: true, data: ann });
    } catch (e) { next(e); }
  }
}
