import { Response, NextFunction } from "express";
import Survey from "../models/Survey";
import { AuthRequest } from "../types";

export class SurveyController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveys = await Survey.find().select("-responses").populate("createdBy", "name").sort("-createdAt");
      const userId = req.user!._id.toString();
      const withStatus = surveys.map((s) => {
        const obj = s.toObject();
        const responded = s.responses?.some((r: any) => r.userId?.toString() === userId);
        return { ...obj, responded };
      });
      res.json({ success: true, data: withStatus });
    } catch (e) { next(e); }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const survey = await Survey.findById(req.params.id as string).select("-responses").populate("createdBy", "name");
      if (!survey) { res.status(404).json({ success: false, message: "Not found." }); return; }
      res.json({ success: true, data: survey });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const survey = await Survey.create({ ...req.body, createdBy: req.user!._id });
      res.status(201).json({ success: true, data: survey });
    } catch (e) { next(e); }
  }

  static async submit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { answers, anonymous } = req.body;
      await Survey.findByIdAndUpdate(req.params.id as string, {
        $push: { responses: { userId: anonymous ? undefined : req.user!._id, anonymous, answers } },
      });
      res.json({ success: true, message: "Response submitted." });
    } catch (e) { next(e); }
  }

  static async getResults(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const survey = await Survey.findById(req.params.id as string).populate("createdBy", "name");
      if (!survey) { res.status(404).json({ success: false, message: "Not found." }); return; }
      res.json({ success: true, data: survey });
    } catch (e) { next(e); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await Survey.findByIdAndDelete(req.params.id as string);
      res.json({ success: true, message: "Deleted." });
    } catch (e) { next(e); }
  }
}
