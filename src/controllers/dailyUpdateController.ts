import { Response, NextFunction } from "express";
import { DailyUpdateService } from "../services/dailyUpdateService";
import { NotificationService } from "../services/notificationService";
import { AuthRequest } from "../types";

export class DailyUpdateController {
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DailyUpdateService.create(req.user!._id.toString(), req.body);
      NotificationService.notifyApprovers(
        {
          sender: req.user!._id,
          type: "system",
          title: "New daily update",
          message: `${req.user!.name} posted a daily update`,
          link: "/daily-updates/team",
          entityType: "DailyUpdate",
          entityId: (data as any)?._id,
        },
        req.user!._id
      ).catch(() => {});
      res.status(201).json({ success: true, message: "Daily update submitted.", data });
    } catch (e) { next(e); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DailyUpdateService.update(req.params.id as string, req.user!._id.toString(), req.body);
      res.json({ success: true, message: "Update edited.", data });
    } catch (e) { next(e); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await DailyUpdateService.delete(req.params.id as string, req.user!._id.toString());
      res.json({ success: true, message: "Update deleted." });
    } catch (e) { next(e); }
  }

  static async getMyUpdates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DailyUpdateService.getMyUpdates(req.user!._id.toString(), req.query as any);
      res.json({ success: true, message: "Updates fetched.", ...result });
    } catch (e) { next(e); }
  }

  static async getTeamUpdates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DailyUpdateService.getTeamUpdates(req.query as any);
      res.json({ success: true, message: "Team updates fetched.", ...result });
    } catch (e) { next(e); }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DailyUpdateService.getById(req.params.id as string);
      res.json({ success: true, message: "Update fetched.", data });
    } catch (e) { next(e); }
  }

  static async review(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DailyUpdateService.review(req.params.id as string, req.user!._id.toString(), req.body);
      if (data) {
        NotificationService.create({
          recipient: (data as any).userId,
          sender: req.user!._id,
          type: "system",
          title: "Daily update reviewed",
          message: `${req.user!.name} reviewed your daily update`,
          link: "/daily-updates",
          entityType: "DailyUpdate",
          entityId: (data as any)._id,
        }).catch(() => {});
      }
      res.json({ success: true, message: "Update reviewed.", data });
    } catch (e) { next(e); }
  }
}
