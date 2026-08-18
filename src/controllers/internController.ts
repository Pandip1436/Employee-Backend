import { Response, NextFunction } from "express";
import { InternService } from "../services/internService";
import { InternCertificateService } from "../services/internCertificateService";
import { AuditService } from "../services/auditService";
import { AuthRequest } from "../types";

export class InternController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await InternService.getAll(req.query as any);
      res.status(200).json({
        success: true,
        message: "Interns fetched successfully.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await InternService.getStats();
      res.status(200).json({ success: true, message: "Intern stats fetched.", data });
    } catch (error) {
      next(error);
    }
  }

  static async getMentors(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await InternService.getMentorOptions();
      res.status(200).json({ success: true, message: "Mentors fetched.", data });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const intern = await InternService.getById(req.params.id as string);
      res.status(200).json({ success: true, message: "Intern fetched successfully.", data: intern });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const intern = await InternService.create(req.body);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Intern created",
        module: "interns",
        details: `Created ${intern.name} (userId: ${intern.userId})`,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, message: "Intern created successfully.", data: intern });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const intern = await InternService.update(req.params.id as string, req.body);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Intern updated",
        module: "interns",
        details: `Updated ${intern.name} (userId: ${intern.userId})`,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, message: "Intern updated successfully.", data: intern });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await InternService.resetPassword(req.params.id as string, req.body.password);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Intern password reset",
        module: "interns",
        details: `Reset password for intern ${req.params.id}`,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, message: "Password reset. The intern must sign in again." });
    } catch (error) {
      next(error);
    }
  }

  // Streams the completion certificate as a PDF. `?download=1` prompts a save
  // dialog; without it the file renders inline so the UI can preview it.
  static async getCertificate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { buffer, filename } = await InternCertificateService.generate(
        req.params.id as string,
      );
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async sendCertificate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await InternCertificateService.send(req.params.id as string, {
        email: req.body.email,
        message: req.body.message,
      });
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Intern certificate sent",
        module: "interns",
        details: `Certificate ${result.certificateNo} emailed to ${result.sentTo}`,
        ipAddress: req.ip,
      });
      res.status(200).json({
        success: true,
        message: `Certificate sent to ${result.sentTo}.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await InternService.delete(req.params.id as string);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Intern deleted",
        module: "interns",
        details: `Deleted intern ${req.params.id}`,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, message: "Intern deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}
