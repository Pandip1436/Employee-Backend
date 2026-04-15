import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { NotificationService } from "../services/notificationService";
import { parsePagination } from "../utils/helpers";

export class NotificationController {
  static async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = parsePagination(req.query as any);
      const unreadOnly = req.query.unread === "true";
      const result = await NotificationService.list(req.user!._id, { page, limit, unreadOnly });
      res.json({
        success: true,
        data: result.data,
        unread: result.unread,
        pagination: { total: result.total, page: result.page, limit: result.limit, pages: Math.ceil(result.total / result.limit) },
      });
    } catch (e) {
      next(e);
    }
  }

  static async unreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await NotificationService.unreadCount(req.user!._id);
      res.json({ success: true, data: { count } });
    } catch (e) {
      next(e);
    }
  }

  static async markRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await NotificationService.markRead(req.user!._id, req.params.id as string);
      if (!updated) {
        res.status(404).json({ success: false, message: "Notification not found." });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  static async markAllRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await NotificationService.markAllRead(req.user!._id);
      res.json({ success: true, message: "All notifications marked as read." });
    } catch (e) {
      next(e);
    }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await NotificationService.remove(req.user!._id, req.params.id as string);
      if (!deleted) {
        res.status(404).json({ success: false, message: "Notification not found." });
        return;
      }
      res.json({ success: true, message: "Deleted." });
    } catch (e) {
      next(e);
    }
  }
}
