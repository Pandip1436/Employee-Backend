import { Response, NextFunction } from "express";
import { DailyUpdateService } from "../services/dailyUpdateService";
import { AuthRequest } from "../types";

export class DailyUpdateController {
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DailyUpdateService.create(req.user!._id.toString(), req.body);
      res.status(201).json({ success: true, message: "Daily update submitted.", data });
    } catch (e) { next(e); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DailyUpdateService.update(req.params.id, req.user!._id.toString(), req.body);
      res.json({ success: true, message: "Update edited.", data });
    } catch (e) { next(e); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await DailyUpdateService.delete(req.params.id, req.user!._id.toString());
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
      const data = await DailyUpdateService.getById(req.params.id);
      res.json({ success: true, message: "Update fetched.", data });
    } catch (e) { next(e); }
  }
}
