import { Response, NextFunction } from "express";
import { CompOffService } from "../services/compOffService";
import { NotificationService } from "../services/notificationService";
import { AuthRequest } from "../types";

export class CompOffController {
  static async apply(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const compOff = await CompOffService.apply(req.user!._id.toString(), req.body);
      NotificationService.notifyApprovers(
        {
          sender: req.user!._id,
          type: "compoff",
          title: "New comp-off request",
          message: `${req.user!.name} submitted a comp-off request`,
          link: "/compoff/approvals",
          entityType: "CompOff",
          entityId: (compOff as any)._id,
        },
        req.user!._id
      ).catch(() => {});
      res.status(201).json({ success: true, message: "Comp-off request submitted.", data: compOff });
    } catch (error) { next(error); }
  }

  static async getMyRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompOffService.getMyRequests(req.user!._id.toString(), req.query as any);
      res.status(200).json({ success: true, message: "Comp-off requests fetched.", ...result });
    } catch (error) { next(error); }
  }

  static async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const balance = await CompOffService.getBalance(req.user!._id.toString());
      res.status(200).json({ success: true, message: "Comp-off balance.", data: balance });
    } catch (error) { next(error); }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CompOffService.getAll(req.query as any);
      res.status(200).json({ success: true, message: "All comp-off requests.", ...result });
    } catch (error) { next(error); }
  }

  static async approve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      const compOff = await CompOffService.approve(req.params.id as string, req.user!._id.toString(), status);
      if (compOff) {
        NotificationService.create({
          recipient: (compOff as any).userId,
          sender: req.user!._id,
          type: "compoff",
          title: `Comp-off ${status}`,
          message: `Your comp-off request was ${status}.`,
          link: "/attendance/compoff",
          entityType: "CompOff",
          entityId: (compOff as any)._id,
        }).catch(() => {});
      }
      res.status(200).json({ success: true, message: `Comp-off ${status}.`, data: compOff });
    } catch (error) { next(error); }
  }

  static async markUsed(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const compOff = await CompOffService.markUsed(req.params.id as string, req.user!._id.toString());
      res.status(200).json({ success: true, message: "Comp-off marked as used.", data: compOff });
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await CompOffService.delete(req.params.id as string, req.user!._id.toString());
      res.status(200).json({ success: true, message: "Comp-off cancelled." });
    } catch (error) { next(error); }
  }
}
