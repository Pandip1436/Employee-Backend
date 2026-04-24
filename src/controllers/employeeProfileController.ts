import { Response, NextFunction } from "express";
import { EmployeeProfileService } from "../services/employeeProfileService";
import { StorageService } from "../services/storageService";
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

  static async updateByUserId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await EmployeeProfileService.update(req.params.id as string, req.body);
      res.status(200).json({ success: true, message: "Profile updated.", data: profile });
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
      const key = await StorageService.upload({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: "profiles/photos",
      });
      const profile = await EmployeeProfileService.uploadProfilePhoto(req.user!._id.toString(), key);
      res.status(200).json({ success: true, message: "Photo uploaded.", data: profile });
    } catch (error) { next(error); }
  }

  static async uploadOfferLetter(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: "No file." }); return; }
      const key = await StorageService.upload({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: "profiles/offer-letters",
      });
      const profile = await EmployeeProfileService.uploadOfferLetter(req.user!._id.toString(), key);
      res.status(200).json({ success: true, message: "Offer letter uploaded.", data: profile });
    } catch (error) { next(error); }
  }

  static async uploadCertificates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || !files.length) {
        res.status(400).json({ success: false, message: "No files." }); return;
      }
      const keys = await Promise.all(
        files.map((f) =>
          StorageService.upload({
            buffer: f.buffer,
            originalName: f.originalname,
            mimeType: f.mimetype,
            folder: "profiles/certificates",
          })
        )
      );
      const profile = await EmployeeProfileService.uploadCertificates(req.user!._id.toString(), keys);
      res.status(200).json({ success: true, message: "Certificates uploaded.", data: profile });
    } catch (error) { next(error); }
  }
}
