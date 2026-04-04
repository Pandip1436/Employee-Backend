import { Response, NextFunction } from "express";
import Goal from "../models/Goal";
import Review from "../models/Review";
import FeedbackModel from "../models/Feedback";
import PIP from "../models/PIP";
import ReviewCycle from "../models/ReviewCycle";
import { AuthRequest } from "../types";
import { parsePagination } from "../utils/helpers";

export class PerformanceController {
  // ── Goals ──
  static async getGoals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.query.userId || req.user!._id;
      const filter: Record<string, unknown> = { userId };
      if (req.query.status) filter.status = req.query.status;
      const goals = await Goal.find(filter).sort("-createdAt");
      res.json({ success: true, data: goals });
    } catch (e) { next(e); }
  }
  static async createGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await Goal.create({ ...req.body, userId: req.user!._id });
      res.status(201).json({ success: true, data: goal });
    } catch (e) { next(e); }
  }
  static async updateGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await Goal.findByIdAndUpdate(req.params.id as string, req.body, { new: true });
      res.json({ success: true, data: goal });
    } catch (e) { next(e); }
  }
  static async deleteGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { await Goal.findByIdAndDelete(req.params.id as string); res.json({ success: true }); } catch (e) { next(e); }
  }

  // ── Reviews ──
  static async getReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await Review.findById(req.params.id as string).populate("employeeId", "name email department").populate("managerId", "name email");
      res.json({ success: true, data: review });
    } catch (e) { next(e); }
  }
  static async submitSelfReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await Review.findByIdAndUpdate(req.params.id as string, { ...req.body, selfSubmittedAt: new Date(), status: "self-done" }, { new: true });
      res.json({ success: true, data: review });
    } catch (e) { next(e); }
  }
  static async submitManagerReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await Review.findByIdAndUpdate(req.params.id as string, { ...req.body, managerSubmittedAt: new Date(), status: "mgr-done" }, { new: true });
      res.json({ success: true, data: review });
    } catch (e) { next(e); }
  }
  static async getMyReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviews = await Review.find({ employeeId: req.user!._id }).populate("cycleId").sort("-createdAt");
      res.json({ success: true, data: reviews });
    } catch (e) { next(e); }
  }
  static async getTeamReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviews = await Review.find({ managerId: req.user!._id }).populate("employeeId", "name email department").populate("cycleId").sort("-createdAt");
      res.json({ success: true, data: reviews });
    } catch (e) { next(e); }
  }

  // ── Feedback ──
  static async giveFeedback(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const fb = await FeedbackModel.create({ ...req.body, fromUser: req.body.anonymous ? undefined : req.user!._id });
      res.status(201).json({ success: true, data: fb });
    } catch (e) { next(e); }
  }
  static async getMyFeedback(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const feedback = await FeedbackModel.find({ toUser: req.user!._id }).populate("fromUser", "name").sort("-createdAt");
      res.json({ success: true, data: feedback });
    } catch (e) { next(e); }
  }
  static async getFeedbackFor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const feedback = await FeedbackModel.find({ toUser: req.params.userId as string }).populate("fromUser", "name").sort("-createdAt");
      res.json({ success: true, data: feedback });
    } catch (e) { next(e); }
  }

  // ── PIP ──
  static async getPIP(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pip = await PIP.findById(req.params.id as string).populate("employeeId", "name email").populate("managerId", "name");
      res.json({ success: true, data: pip });
    } catch (e) { next(e); }
  }
  static async createPIP(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pip = await PIP.create({ ...req.body, managerId: req.user!._id });
      res.status(201).json({ success: true, data: pip });
    } catch (e) { next(e); }
  }
  static async updatePIP(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pip = await PIP.findByIdAndUpdate(req.params.id as string, req.body, { new: true });
      res.json({ success: true, data: pip });
    } catch (e) { next(e); }
  }
  static async getAllPIPs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pips = await PIP.find().populate("employeeId", "name email department").populate("managerId", "name").sort("-createdAt");
      res.json({ success: true, data: pips });
    } catch (e) { next(e); }
  }

  // ── Cycles ──
  static async getCycles(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { res.json({ success: true, data: await ReviewCycle.find().sort("-startDate") }); } catch (e) { next(e); }
  }
  static async createCycle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cycle = await ReviewCycle.create({ ...req.body, createdBy: req.user!._id });
      res.status(201).json({ success: true, data: cycle });
    } catch (e) { next(e); }
  }
  static async updateCycle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cycle = await ReviewCycle.findByIdAndUpdate(req.params.id as string, req.body, { new: true });
      res.json({ success: true, data: cycle });
    } catch (e) { next(e); }
  }

  // ── Calibration ──
  static async getCalibrationData(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviews = await Review.find({ status: { $in: ["mgr-done", "completed"] } }).populate("employeeId", "name email department").select("employeeId finalRating managerRating");
      res.json({ success: true, data: reviews });
    } catch (e) { next(e); }
  }
  static async calibrate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reviewId, finalRating } = req.body;
      await Review.findByIdAndUpdate(reviewId, { finalRating, status: "completed" });
      res.json({ success: true });
    } catch (e) { next(e); }
  }
}
