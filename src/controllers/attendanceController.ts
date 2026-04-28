import { Response, NextFunction } from "express";
import { AttendanceService } from "../services/attendanceService";
import { EmailService } from "../services/emailService";
import { AuditService } from "../services/auditService";
import { AuthRequest } from "../types";

export class AttendanceController {
  static async clockIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await AttendanceService.clockIn(
        req.user!._id.toString(),
        req.body.notes
      );

      // Send clock-in email to admins (non-blocking)
      EmailService.sendClockInNotification(
        req.user!.name,
        req.user!.email,
        record.clockIn!
      );

      // Send late alert if employee is late
      if (record.isLate && record.lateByMinutes > 0) {
        EmailService.sendLateAlertNotification(
          req.user!.name,
          req.user!.email,
          record.clockIn!,
          record.lateByMinutes
        );
      }

      const message = record.isLate
        ? `Clocked in (late by ${record.lateByMinutes} min).`
        : "Clocked in successfully.";

      AuditService.log({
        userId: req.user!._id.toString(),
        action: record.isLate ? "Clocked in (late)" : "Clocked in",
        module: "attendance",
        details: record.isLate ? `Late by ${record.lateByMinutes} min` : undefined,
        ipAddress: req.ip,
      });

      res.status(200).json({ success: true, message, data: record });
    } catch (error) { next(error); }
  }

  static async clockOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await AttendanceService.clockOut(
        req.user!._id.toString(),
        req.body.notes
      );

      // Send email notification to admins (non-blocking)
      EmailService.sendClockOutNotification(
        req.user!.name,
        req.user!.email,
        record.clockIn!,
        record.clockOut!,
        record.totalHours!
      );

      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Clocked out",
        module: "attendance",
        details: `${record.totalHours}h worked`,
        ipAddress: req.ip,
      });

      res.status(200).json({ success: true, message: "Clocked out successfully.", data: record });
    } catch (error) { next(error); }
  }

  static async getMyToday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await AttendanceService.getMyToday(req.user!._id.toString());
      res.status(200).json({ success: true, message: "Today's attendance.", data: record });
    } catch (error) { next(error); }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AttendanceService.getAll(req.query as any);
      res.status(200).json({ success: true, message: "Attendance records fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async getTodayLiveStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const result = await AttendanceService.getTodayLiveStatus(date);
      res.status(200).json({ success: true, message: "Live status fetched.", data: result });
    } catch (error) { next(error); }
  }

  static async getMyHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AttendanceService.getMyHistory(
        req.user!._id.toString(),
        req.query as any
      );
      res.status(200).json({ success: true, message: "Attendance history fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async getPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AttendanceService.getPreferences(req.user!._id.toString());
      res.status(200).json({ success: true, message: "Preferences fetched.", data });
    } catch (error) { next(error); }
  }

  static async markAbsentBackfill(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.body as { from?: string; to?: string };
      if (!from || !to) {
        res.status(400).json({ success: false, message: "Both 'from' and 'to' (YYYY-MM-DD) are required." });
        return;
      }
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD." });
        return;
      }
      // Normalize to UTC midnight to match Attendance.date storage
      const fromUtc = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
      const toUtc = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));

      const result = await AttendanceService.markAbsentForRange(fromUtc, toUtc);

      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Backfill absent records",
        module: "attendance",
        details: `${from} to ${to} — ${result.totalCreated} record(s) created`,
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        message: `Backfill complete. ${result.totalCreated} record(s) created across ${result.days.length} day(s).`,
        data: result,
      });
    } catch (error) { next(error); }
  }

  static async updatePreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const enabled = req.body.autoClockOutEnabled;
      if (typeof enabled !== "boolean") {
        res.status(400).json({ success: false, message: "autoClockOutEnabled must be a boolean." });
        return;
      }
      const data = await AttendanceService.updatePreferences(req.user!._id.toString(), enabled);

      AuditService.log({
        userId: req.user!._id.toString(),
        action: enabled ? "Auto clock-out enabled" : "Auto clock-out disabled",
        module: "attendance",
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        message: enabled ? "Auto clock-out enabled." : "Auto clock-out disabled.",
        data,
      });
    } catch (error) { next(error); }
  }
}
