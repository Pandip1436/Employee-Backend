import { Response, NextFunction } from "express";
import { TimerService } from "../services/timerService";
import { AuthRequest } from "../types";

export class TimerController {
  static async start(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, description } = req.body;
      const timer = await TimerService.start(
        req.user!._id.toString(),
        projectId,
        description
      );
      res.status(201).json({
        success: true,
        message: "Timer started.",
        data: timer,
      });
    } catch (error) {
      next(error);
    }
  }

  static async stop(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const timer = await TimerService.stop(
        req.params.id as string,
        req.user!._id.toString()
      );
      res.status(200).json({
        success: true,
        message: "Timer stopped. Timesheet entry created automatically.",
        data: timer,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRunning(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const timer = await TimerService.getRunning(req.user!._id.toString());
      res.status(200).json({
        success: true,
        message: timer ? "Active timer found." : "No active timer.",
        data: timer,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const timers = await TimerService.getHistory(req.user!._id.toString());
      res.status(200).json({
        success: true,
        message: "Timer history fetched.",
        data: timers,
      });
    } catch (error) {
      next(error);
    }
  }
}
