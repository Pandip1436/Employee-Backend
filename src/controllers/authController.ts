import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { AuditService } from "../services/auditService";
import { AuthRequest } from "../types";
import EmployeeProfile from "../models/EmployeeProfile";
import { StorageService } from "../services/storageService";

// Resolve the current profile photo URL (fresh signed URL) for the given user.
// Returns undefined if no photo is set or the signing call fails.
async function getProfilePhotoUrl(userId: string): Promise<string | undefined> {
  try {
    const profile = await EmployeeProfile.findOne({ userId }).select("profilePhoto").lean();
    if (!profile?.profilePhoto) return undefined;
    return await StorageService.getSignedDownloadUrl(profile.profilePhoto, 3600);
  } catch {
    return undefined;
  }
}

export class AuthController {
  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId, password } = req.body;
      const { user, token } = await AuthService.login(userId, password);
      AuditService.log({
        userId: user._id.toString(),
        action: "User logged in",
        module: "auth",
        details: `${user.name} (${user.userId})`,
        ipAddress: req.ip,
      });
      const profilePhotoUrl = await getProfilePhotoUrl(user._id.toString());
      const userPayload = { ...(user as any).toJSON?.() ?? user, profilePhotoUrl };
      res.status(200).json({
        success: true,
        message: "Login successful.",
        data: { user: userPayload, token },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    const profilePhotoUrl = await getProfilePhotoUrl(req.user!._id.toString());
    const userPayload = { ...(req.user as any).toJSON?.() ?? req.user, profilePhotoUrl };
    res.status(200).json({
      success: true,
      message: "User profile fetched.",
      data: userPayload,
    });
  }

  static async logout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await AuthService.logout(req.user!._id.toString());
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "User logged out",
        module: "auth",
        details: req.user!.email,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, message: "Logged out successfully." });
    } catch (error) { next(error); }
  }

  static async updateProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await AuthService.updateProfile(req.user!._id.toString(), req.body);
      res.status(200).json({ success: true, message: "Profile updated.", data: user });
    } catch (error) { next(error); }
  }

  static async changePassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user!._id.toString(), currentPassword, newPassword);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Password changed",
        module: "auth",
        details: req.user!.email,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, message: "Password changed successfully." });
    } catch (error) { next(error); }
  }

  static async updateStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await AuthService.updateStatus(req.user!._id.toString(), req.body.userStatus);
      res.status(200).json({ success: true, message: "Status updated.", data: user });
    } catch (error) { next(error); }
  }
}
