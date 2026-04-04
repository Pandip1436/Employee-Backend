import { Response, NextFunction } from "express";
import ActivityType from "../models/ActivityType";
import TimesheetPolicy from "../models/TimesheetPolicy";
import { AuthRequest } from "../types";

export class ConfigController {
  // Activity Types
  static async getActivityTypes(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ActivityType.find().sort("name");
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }
  static async createActivityType(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ActivityType.create({ name: req.body.name });
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  }
  static async deleteActivityType(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await ActivityType.findByIdAndDelete(req.params.id as string);
      res.json({ success: true, message: "Deleted." });
    } catch (e) { next(e); }
  }

  // Policies
  static async getPolicies(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TimesheetPolicy.find();
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }
  static async upsertPolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, value, label } = req.body;
      const data = await TimesheetPolicy.findOneAndUpdate({ key }, { value, label }, { upsert: true, new: true });
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }
}
