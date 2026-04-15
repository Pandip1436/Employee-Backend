import { Response, NextFunction } from "express";
import { EmployeeProfileService } from "../services/employeeProfileService";
import { AuthRequest } from "../types";

export class EmployeeProfileController {
  static async getMyProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await EmployeeProfileService.getByUserId(req.user!._id.toString(), true);
      res.status(200).json({ success: true, message: "Profile fetched.", data: profile });
    } catch (error) { next(error); }
  }

  static async getByUserId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Admin/manager viewing another employee — return unmasked sensitive fields
      const profile = await EmployeeProfileService.getByUserId(req.params.id as string, true);
      res.status(200).json({ success: true, message: "Profile fetched.", data: profile });
    } catch (error) { next(error); }
  }

  static async updateMyProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await EmployeeProfileService.update(req.user!._id.toString(), req.body);
      res.status(200).json({ success: true, message: "Profile updated.", data: profile });
    } catch (error) { next(error); }
  }

  static async uploadPhoto(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: "No file." }); return; }
      const profile = await EmployeeProfileService.uploadProfilePhoto(req.user!._id.toString(), req.file.path);
      res.status(200).json({ success: true, message: "Photo uploaded.", data: profile });
    } catch (error) { next(error); }
  }

  static async uploadOfferLetter(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: "No file." }); return; }
      const profile = await EmployeeProfileService.uploadOfferLetter(req.user!._id.toString(), req.file.path);
      res.status(200).json({ success: true, message: "Offer letter uploaded.", data: profile });
    } catch (error) { next(error); }
  }

  static async uploadCertificates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.files || !(req.files as Express.Multer.File[]).length) {
        res.status(400).json({ success: false, message: "No files." }); return;
      }
      const paths = (req.files as Express.Multer.File[]).map((f) => f.path);
      const profile = await EmployeeProfileService.uploadCertificates(req.user!._id.toString(), paths);
      res.status(200).json({ success: true, message: "Certificates uploaded.", data: profile });
    } catch (error) { next(error); }
  }
}
