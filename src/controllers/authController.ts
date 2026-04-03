import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { AuthRequest } from "../types";

export class AuthController {
  static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, token } = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        message: "User registered successfully.",
        data: { user, token },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.login(email, password);
      res.status(200).json({
        success: true,
        message: "Login successful.",
        data: { user, token },
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
    res.status(200).json({
      success: true,
      message: "User profile fetched.",
      data: req.user,
    });
  }

  static async logout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await AuthService.logout(req.user!._id.toString());
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
      res.status(200).json({ success: true, message: "Password changed successfully." });
    } catch (error) { next(error); }
  }
}
