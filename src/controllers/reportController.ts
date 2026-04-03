import { Response, NextFunction } from "express";
import { ReportService } from "../services/reportService";
import { AuthRequest } from "../types";
import { ApiError } from "../utils/ApiError";

export class ReportController {
  static async getEmployeeReport(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { startDate, endDate, userId } = req.query as Record<string, string>;
      if (!startDate || !endDate) {
        throw new ApiError(400, "startDate and endDate are required.");
      }

      const report = await ReportService.getEmployeeReport({
        userId,
        startDate,
        endDate,
      });

      res.status(200).json({
        success: true,
        message: "Employee report generated.",
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProjectReport(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { startDate, endDate, projectId } = req.query as Record<string, string>;
      if (!startDate || !endDate) {
        throw new ApiError(400, "startDate and endDate are required.");
      }

      const report = await ReportService.getProjectReport({
        projectId,
        startDate,
        endDate,
      });

      res.status(200).json({
        success: true,
        message: "Project report generated.",
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getWeeklySummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId =
        (req.query.userId as string) || req.user!._id.toString();
      const report = await ReportService.getWeeklySummary(userId);

      res.status(200).json({
        success: true,
        message: "Weekly summary generated.",
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }
}
