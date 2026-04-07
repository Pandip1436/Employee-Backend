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

  static async getTodayLiveStatus(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AttendanceService.getTodayLiveStatus();
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
}
