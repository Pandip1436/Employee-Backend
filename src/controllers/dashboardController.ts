import { Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboardService";
import { AuthRequest } from "../types";

export class DashboardController {
  static async getEmployeeKpis(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getEmployeeKpis(req.user!._id.toString());
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  static async getManagerStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getManagerStats();
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  static async getHrStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getHrStats();
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  static async getUpcomingEvents(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getUpcomingEvents();
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  static async getPendingApprovals(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getPendingApprovals();
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  static async getTeamLeaveCalendar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const month = (req.query.month as string) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const data = await DashboardService.getTeamLeaveCalendar(month);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }
}
