import { Response, NextFunction } from "express";
import CompanySettings from "../models/CompanySettings";
import AuditLog from "../models/AuditLog";
import { AuditService } from "../services/auditService";
import { AuthRequest } from "../types";
import { parsePagination } from "../utils/helpers";

async function getSettings() {
  let settings = await CompanySettings.findOne();
  if (!settings) settings = await CompanySettings.create({});
  return settings;
}

export class AdminSettingsController {
  // Company Settings
  static async getCompanySettings(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { res.json({ success: true, data: await getSettings() }); } catch (e) { next(e); }
  }
  static async updateCompanySettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await getSettings();
      Object.assign(settings, req.body);
      await settings.save();
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Company settings updated",
        module: "settings",
        details: `Fields: ${Object.keys(req.body).join(", ")}`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: settings });
    } catch (e) { next(e); }
  }

  // Designations
  static async getDesignations(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.designations }); } catch (e) { next(e); }
  }
  static async updateDesignations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const s = await getSettings();
      s.designations = req.body.designations;
      await s.save();
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Designations updated",
        module: "settings",
        details: `${s.designations.length} designations`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: s.designations });
    } catch (e) { next(e); }
  }

  // Roles & Permissions
  static async getRoles(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.roles }); } catch (e) { next(e); }
  }
  static async updateRoles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const s = await getSettings();
      s.roles = req.body.roles;
      await s.save();
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Roles & permissions updated",
        module: "roles",
        details: `${s.roles.length} roles`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: s.roles });
    } catch (e) { next(e); }
  }

  // Leave Policy
  static async getLeavePolicy(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.leavePolicy }); } catch (e) { next(e); }
  }
  static async updateLeavePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const s = await getSettings();
      s.leavePolicy = req.body;
      await s.save();
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Leave policy updated",
        module: "settings",
        ipAddress: req.ip,
      });
      res.json({ success: true, data: s.leavePolicy });
    } catch (e) { next(e); }
  }

  // Email Templates
  static async getEmailTemplates(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.emailTemplates }); } catch (e) { next(e); }
  }
  static async updateEmailTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const s = await getSettings();
      s.emailTemplates = req.body.templates;
      await s.save();
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Email templates updated",
        module: "settings",
        details: `${s.emailTemplates.length} templates`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: s.emailTemplates });
    } catch (e) { next(e); }
  }

  // Audit Logs
  static async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req.query as any);
      const filter: Record<string, unknown> = {};
      if (req.query.userId) filter.userId = req.query.userId;
      if (req.query.module) filter.module = req.query.module;
      if (req.query.action) {
        // Case-insensitive partial match for action search
        const escaped = String(req.query.action).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.action = { $regex: escaped, $options: "i" };
      }
      const [data, total] = await Promise.all([
        AuditLog.find(filter).populate("userId", "name email").sort("-createdAt").skip(skip).limit(limit),
        AuditLog.countDocuments(filter),
      ]);
      res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (e) { next(e); }
  }
}
