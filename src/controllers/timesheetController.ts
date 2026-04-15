import { Response, NextFunction } from "express";
import { TimesheetService } from "../services/timesheetService";
import { NotificationService } from "../services/notificationService";
import { AuthRequest } from "../types";

export class TimesheetController {
  static async create(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const timesheet = await TimesheetService.create(
        req.body,
        req.user!._id.toString()
      );
      res.status(201).json({
        success: true,
        message: "Timesheet entry created.",
        data: timesheet,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const isManagerOrAdmin = ["admin", "manager"].includes(req.user!.role);
      const result = await TimesheetService.getAll(
        req.query as any,
        req.user!._id.toString(),
        isManagerOrAdmin
      );
      res.status(200).json({
        success: true,
        message: "Timesheets fetched successfully.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const timesheet = await TimesheetService.getById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: "Timesheet entry fetched.",
        data: timesheet,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const timesheet = await TimesheetService.update(
        req.params.id as string,
        req.body,
        req.user!._id.toString()
      );
      res.status(200).json({
        success: true,
        message: "Timesheet entry updated.",
        data: timesheet,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await TimesheetService.delete(
        req.params.id as string,
        req.user!._id.toString()
      );
      res.status(200).json({
        success: true,
        message: "Timesheet entry deleted.",
      });
    } catch (error) {
      next(error);
    }
  }

  static async submit(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const timesheet = await TimesheetService.submit(
        req.params.id as string,
        req.user!._id.toString()
      );
      NotificationService.notifyApprovers(
        {
          sender: req.user!._id,
          type: "timesheet",
          title: "Timesheet submitted",
          message: `${req.user!.name} submitted a timesheet for approval`,
          link: "/timesheet/approvals",
          entityType: "Timesheet",
          entityId: (timesheet as any)?._id,
        },
        req.user!._id
      ).catch(() => {});
      res.status(200).json({
        success: true,
        message: "Timesheet submitted for approval.",
        data: timesheet,
      });
    } catch (error) {
      next(error);
    }
  }

  static async approve(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { status, rejectionComment } = req.body;
      const timesheet = await TimesheetService.approve(
        req.params.id as string,
        req.user!._id.toString(),
        status,
        rejectionComment
      );
      if (timesheet) {
        NotificationService.create({
          recipient: (timesheet as any).userId,
          sender: req.user!._id,
          type: "timesheet",
          title: `Timesheet ${status}`,
          message:
            status === "rejected" && rejectionComment
              ? `Your timesheet was rejected. Reason: ${rejectionComment}`
              : `Your timesheet was ${status}.`,
          link: "/timesheet/history",
          entityType: "Timesheet",
          entityId: (timesheet as any)._id,
        }).catch(() => {});
      }
      res.status(200).json({
        success: true,
        message: `Timesheet ${status}.`,
        data: timesheet,
      });
    } catch (error) {
      next(error);
    }
  }
}
