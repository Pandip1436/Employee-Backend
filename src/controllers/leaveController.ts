import { Response, NextFunction } from "express";
import { LeaveService } from "../services/leaveService";
import { AuthRequest } from "../types";

export class LeaveController {
  static async apply(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const leave = await LeaveService.apply(req.user!._id.toString(), req.body);
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
      res.status(200).json({ success: true, message: `Leave ${status}.`, data: leave });
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await LeaveService.delete(req.params.id as string, req.user!._id.toString());
      res.status(200).json({ success: true, message: "Leave request cancelled." });
    } catch (error) { next(error); }
  }
}
