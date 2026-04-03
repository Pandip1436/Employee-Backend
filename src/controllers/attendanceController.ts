import { Response, NextFunction } from "express";
import { AttendanceService } from "../services/attendanceService";
import { AuthRequest } from "../types";

export class AttendanceController {
  static async clockIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await AttendanceService.clockIn(
        req.user!._id.toString(),
        req.body.notes
      );
      res.status(200).json({ success: true, message: "Clocked in successfully.", data: record });
    } catch (error) { next(error); }
  }

  static async clockOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await AttendanceService.clockOut(
        req.user!._id.toString(),
        req.body.notes
      );
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
