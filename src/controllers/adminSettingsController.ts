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
      await getSettings();
      const updated = await CompanySettings.findOneAndUpdate(
        {},
        { $set: req.body },
        { new: true, upsert: true }
      );
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Company settings updated",
        module: "settings",
        details: `Fields: ${Object.keys(req.body).join(", ")}`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // Designations
  static async getDesignations(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.designations }); } catch (e) { next(e); }
  }
  static async updateDesignations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await getSettings();
      const designations = Array.isArray(req.body.designations) ? req.body.designations : [];
      const updated = await CompanySettings.findOneAndUpdate(
        {},
        { $set: { designations } },
        { new: true, upsert: true }
      );
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Designations updated",
        module: "settings",
        details: `${designations.length} designations`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: updated?.designations });
    } catch (e) { next(e); }
  }

  // Roles & Permissions
  static async getRoles(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.roles }); } catch (e) { next(e); }
  }
  static async updateRoles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await getSettings();
      const roles = Array.isArray(req.body.roles) ? req.body.roles : [];
      const updated = await CompanySettings.findOneAndUpdate(
        {},
        { $set: { roles } },
        { new: true, upsert: true }
      );
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Roles & permissions updated",
        module: "roles",
        details: `${roles.length} roles`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: updated?.roles });
    } catch (e) { next(e); }
  }

  // Leave Policy
  static async getLeavePolicy(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.leavePolicy }); } catch (e) { next(e); }
  }
  static async updateLeavePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure a settings doc exists
      await getSettings();

      // Use findOneAndUpdate with $set so nested-schema changes persist reliably.
      // (Assigning to s.leavePolicy directly does not trigger Mongoose change detection
      //  for nested paths in some schema definitions.)
      const updated = await CompanySettings.findOneAndUpdate(
        {},
        { $set: { leavePolicy: req.body } },
        { new: true, upsert: true }
      );

      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Leave policy updated",
        module: "settings",
        ipAddress: req.ip,
      });
      res.json({ success: true, data: updated?.leavePolicy });
    } catch (e) { next(e); }
  }

  // Email Templates
  static async getEmailTemplates(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { const s = await getSettings(); res.json({ success: true, data: s.emailTemplates }); } catch (e) { next(e); }
  }
  static async updateEmailTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await getSettings();
      // Support both { templates: [...] } and a raw array body
      const templates = Array.isArray(req.body.templates)
        ? req.body.templates
        : Array.isArray(req.body)
          ? req.body
          : [];
      const updated = await CompanySettings.findOneAndUpdate(
        {},
        { $set: { emailTemplates: templates } },
        { new: true, upsert: true }
      );
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Email templates updated",
        module: "settings",
        details: `${templates.length} templates`,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: updated?.emailTemplates });
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
