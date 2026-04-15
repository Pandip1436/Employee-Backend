import { Response, NextFunction } from "express";
import { WfhService } from "../services/wfhService";
import { NotificationService } from "../services/notificationService";
import { AuthRequest } from "../types";

export class WfhController {
  static async apply(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const wfh = await WfhService.apply(req.user!._id.toString(), req.body);
      NotificationService.notifyApprovers(
        {
          sender: req.user!._id,
          type: "wfh",
          title: "New WFH request",
          message: `${req.user!.name} requested work from home`,
          link: "/wfh/approvals",
          entityType: "WfhRequest",
          entityId: (wfh as any)._id,
        },
        req.user!._id
      ).catch(() => {});
      res.status(201).json({ success: true, message: "WFH request submitted.", data: wfh });
    } catch (error) { next(error); }
  }

  static async getMyRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await WfhService.getMyRequests(req.user!._id.toString(), req.query as any);
      res.status(200).json({ success: true, message: "WFH requests fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await WfhService.getAll(req.query as any);
      res.status(200).json({ success: true, message: "All WFH requests fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async approve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      const wfh = await WfhService.approve(req.params.id as string, req.user!._id.toString(), status);
      if (wfh) {
        NotificationService.create({
          recipient: (wfh as any).userId,
          sender: req.user!._id,
          type: "wfh",
          title: `WFH request ${status}`,
          message: `Your WFH request was ${status}.`,
          link: "/attendance/wfh",
          entityType: "WfhRequest",
          entityId: (wfh as any)._id,
        }).catch(() => {});
      }
      res.status(200).json({ success: true, message: `WFH request ${status}.`, data: wfh });
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await WfhService.delete(req.params.id as string, req.user!._id.toString());
      res.status(200).json({ success: true, message: "WFH request cancelled." });
    } catch (error) { next(error); }
  }
}
