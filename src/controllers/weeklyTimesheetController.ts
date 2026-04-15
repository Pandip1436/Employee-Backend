import { Response, NextFunction } from "express";
import { WeeklyTimesheetService } from "../services/weeklyTimesheetService";
import { AuditService } from "../services/auditService";
import { AuthRequest } from "../types";

export class WeeklyTimesheetController {
  static async getCurrentWeek(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await WeeklyTimesheetService.getOrCreateWeek(req.user!._id.toString(), req.query.date as string);
      res.json({ success: true, message: "Weekly timesheet fetched.", data: sheet });
    } catch (e) { next(e); }
  }

  static async saveEntries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await WeeklyTimesheetService.saveEntries(req.user!._id.toString(), req.body.weekStart, req.body.entries);
      res.json({ success: true, message: "Entries saved.", data: sheet });
    } catch (e) { next(e); }
  }

  static async submit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await WeeklyTimesheetService.submit(req.user!._id.toString(), req.params.id as string);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Timesheet submitted",
        module: "timesheet",
        details: `${sheet.totalHours}h for week starting ${new Date(sheet.weekStart).toLocaleDateString()}`,
        ipAddress: req.ip,
      });
      res.json({ success: true, message: "Timesheet submitted.", data: sheet });
    } catch (e) { next(e); }
  }

  static async deleteOwn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await WeeklyTimesheetService.deleteOwn(req.params.id as string, req.user!._id.toString());
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Timesheet deleted",
        module: "timesheet",
        details: `Weekly timesheet ${req.params.id}`,
        ipAddress: req.ip,
      });
      res.json({ success: true, message: "Timesheet deleted." });
    } catch (e) { next(e); }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await WeeklyTimesheetService.getById(req.params.id as string);
      res.json({ success: true, message: "Timesheet fetched.", data: sheet });
    } catch (e) { next(e); }
  }

  static async getMyHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await WeeklyTimesheetService.getMyHistory(req.user!._id.toString(), req.query as any);
      res.json({ success: true, message: "History fetched.", ...result });
    } catch (e) { next(e); }
  }

  static async getPendingApprovals(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await WeeklyTimesheetService.getPendingApprovals(_req.query as any);
      res.json({ success: true, message: "Pending approvals fetched.", ...result });
    } catch (e) { next(e); }
  }

  static async approve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, comment } = req.body;
      const sheet = await WeeklyTimesheetService.approve(req.params.id as string, req.user!._id.toString(), status, comment);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: `Timesheet ${status}`,
        module: "approvals",
        details: comment ? `Comment: ${comment}` : `${sheet.totalHours}h reviewed`,
        ipAddress: req.ip,
      });
      res.json({ success: true, message: `Timesheet ${status}.`, data: sheet });
    } catch (e) { next(e); }
  }

  static async getAllSheets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await WeeklyTimesheetService.getAllSheets(req.query as any);
      res.json({ success: true, message: "All timesheets fetched.", ...result });
    } catch (e) { next(e); }
  }

  static async getProjectSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };
      const data = await WeeklyTimesheetService.getProjectSummary(startDate, endDate);
      res.json({ success: true, message: "Project summary fetched.", data });
    } catch (e) { next(e); }
  }

  static async getDashboardStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WeeklyTimesheetService.getDashboardStats();
      res.json({ success: true, message: "Dashboard stats.", data });
    } catch (e) { next(e); }
  }

  static async getMissing(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WeeklyTimesheetService.getMissingSubmissions(req.query.weekStart as string || new Date().toISOString());
      res.json({ success: true, message: "Missing submissions.", data });
    } catch (e) { next(e); }
  }

  static async getOvertimeReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };
      const data = await WeeklyTimesheetService.getOvertimeReport(startDate, endDate);
      res.json({ success: true, message: "Overtime report.", data });
    } catch (e) { next(e); }
  }

  static async sendReminders(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await WeeklyTimesheetService.sendWeeklyReminders();
      res.json({ success: true, message: `Reminders sent to ${result.sent} employees.`, data: result });
    } catch (e) { next(e); }
  }

  static async getCompliance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const weeks = parseInt((req.query.weeks as string) || "8", 10);
      const data = await WeeklyTimesheetService.getCompliance(weeks);
      res.json({ success: true, message: "Compliance report.", data });
    } catch (e) { next(e); }
  }

  static async getEmployeeTimesheetStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { weekStart, department } = req.query as { weekStart?: string; department?: string };
      const data = await WeeklyTimesheetService.getEmployeeTimesheetStatus(weekStart, department);
      res.json({ success: true, message: "Employee timesheet status.", data });
    } catch (e) { next(e); }
  }
}
