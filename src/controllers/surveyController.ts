import { Response, NextFunction } from "express";
import Survey from "../models/Survey";
import { AuthRequest } from "../types";
import { NotificationService } from "../services/notificationService";

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
      const survey = await Survey.findById(req.params.id as string).populate("createdBy", "name");
      if (!survey) { res.status(404).json({ success: false, message: "Not found." }); return; }
      const userId = req.user!._id.toString();
      const responded = survey.responses?.some((r: any) => r.userId?.toString() === userId);
      const { responses: _responses, ...rest } = survey.toObject();
      res.json({ success: true, data: { ...rest, responded } });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const survey = await Survey.create({ ...req.body, createdBy: req.user!._id });
      NotificationService.notifyAll(
        {
          sender: req.user!._id,
          type: "system",
          title: "New survey available",
          message: survey.title || "Please take a moment to respond",
          link: `/surveys/${survey._id}`,
          entityType: "Survey",
          entityId: survey._id,
        },
        req.user!._id
      ).catch(() => {});
      res.status(201).json({ success: true, data: survey });
    } catch (e) { next(e); }
  }

  static async submit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { answers, anonymous } = req.body;
      const surveyId = req.params.id as string;
      const userId = req.user!._id;

      const survey = await Survey.findById(surveyId);
      if (!survey) { res.status(404).json({ success: false, message: "Not found." }); return; }

      const alreadyResponded = survey.responses?.some(
        (r: any) => r.userId && r.userId.toString() === userId.toString()
      );
      if (alreadyResponded) {
        res.status(400).json({ success: false, message: "You have already submitted this survey." });
        return;
      }

      survey.responses.push({ userId: anonymous ? undefined : userId, anonymous, answers } as any);
      await survey.save();
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
