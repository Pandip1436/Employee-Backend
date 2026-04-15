import { Response, NextFunction } from "express";
import { LeaveService } from "../services/leaveService";
import { AuditService } from "../services/auditService";
import { NotificationService } from "../services/notificationService";
import { AuthRequest } from "../types";

export class LeaveController {
  static async apply(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const leave = await LeaveService.apply(req.user!._id.toString(), req.body);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Leave applied",
        module: "leave",
        details: `${req.body.type} leave: ${req.body.startDate} to ${req.body.endDate}`,
        ipAddress: req.ip,
      });
      NotificationService.notifyApprovers(
        {
          sender: req.user!._id,
          type: "leave",
          title: "New leave request",
          message: `${req.user!.name} applied for ${req.body.type} leave (${req.body.startDate} to ${req.body.endDate})`,
          link: "/leave/approvals",
          entityType: "Leave",
          entityId: (leave as any)._id,
        },
        req.user!._id
      ).catch(() => {});
      res.status(201).json({ success: true, message: "Leave applied successfully.", data: leave });
    } catch (error) { next(error); }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LeaveService.getAll(req.query as any);
      res.status(200).json({ success: true, message: "Leave requests fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async getMyLeaves(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LeaveService.getMyLeaves(
        req.user!._id.toString(),
        req.query as any
      );
      res.status(200).json({ success: true, message: "My leaves fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const balance = await LeaveService.getBalance(req.user!._id.toString());
      res.status(200).json({ success: true, message: "Leave balance fetched.", data: balance });
    } catch (error) { next(error); }
  }

  static async approve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, rejectionComment } = req.body;
      const leave = await LeaveService.approve(
        req.params.id as string,
        req.user!._id.toString(),
        status,
        rejectionComment
      );
      AuditService.log({
        userId: req.user!._id.toString(),
        action: `Leave ${status}`,
        module: "approvals",
        details: rejectionComment ? `Reason: ${rejectionComment}` : undefined,
        ipAddress: req.ip,
      });
      NotificationService.create({
        recipient: (leave as any).userId,
        sender: req.user!._id,
        type: "leave",
        title: `Leave ${status}`,
        message:
          status === "rejected" && rejectionComment
            ? `Your leave was rejected. Reason: ${rejectionComment}`
            : `Your leave request was ${status}.`,
        link: "/leaves",
        entityType: "Leave",
        entityId: (leave as any)._id,
      }).catch(() => {});
      res.status(200).json({ success: true, message: `Leave ${status}.`, data: leave });
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await LeaveService.delete(req.params.id as string, req.user!._id.toString());
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Leave cancelled",
        module: "leave",
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, message: "Leave request cancelled." });
    } catch (error) { next(error); }
  }
}
