import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/userService";
import { AuditService } from "../services/auditService";
import { NotificationService } from "../services/notificationService";
import { AuthRequest } from "../types";

export class UserController {
  static async getAll(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await UserService.getAll(req.query as any);
      res.status(200).json({
        success: true,
        message: "Users fetched successfully.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await UserService.getById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: "User fetched successfully.",
        data: user,
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
      const user = await UserService.update(req.params.id as string, req.body);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "User updated",
        module: "employees",
        details: `Target: ${user.email} — fields: ${Object.keys(req.body).join(", ")}`,
        ipAddress: req.ip,
      });
      if (req.user && user._id.toString() !== req.user._id.toString()) {
        if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
          NotificationService.create({
            recipient: user._id,
            sender: req.user._id,
            type: "system",
            title: req.body.isActive ? "Account reactivated" : "Account deactivated",
            message: req.body.isActive
              ? "Your account has been reactivated."
              : "Your account has been deactivated.",
            link: "/profile",
            entityType: "User",
            entityId: user._id,
          }).catch(() => {});
        }
        if (req.body.role) {
          NotificationService.create({
            recipient: user._id,
            sender: req.user._id,
            type: "system",
            title: "Your role was updated",
            message: `Your role is now "${req.body.role}".`,
            link: "/profile",
            entityType: "User",
            entityId: user._id,
          }).catch(() => {});
        }
      }
      res.status(200).json({
        success: true,
        message: "User updated successfully.",
        data: user,
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
      await UserService.delete(req.params.id as string);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "User deleted",
        module: "employees",
        details: `Target user ID: ${req.params.id}`,
        ipAddress: req.ip,
      });
      res.status(200).json({
        success: true,
        message: "User deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
}
