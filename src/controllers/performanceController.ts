import { Response, NextFunction } from "express";
import Goal from "../models/Goal";
import Review from "../models/Review";
import FeedbackModel from "../models/Feedback";
import PIP from "../models/PIP";
import ReviewCycle from "../models/ReviewCycle";
import { AuthRequest } from "../types";
import { parsePagination } from "../utils/helpers";
import { NotificationService } from "../services/notificationService";

export class PerformanceController {
  // ── Goals ──
  static async getGoals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.query.userId || req.user!._id;
      const filter: Record<string, unknown> = { userId };
      if (req.query.status) filter.status = req.query.status;
      if (req.query.period) filter.period = req.query.period;
      if (req.query.year) filter.year = Number(req.query.year);
      if (req.query.category) filter.category = req.query.category;
      const goals = await Goal.find(filter).populate("parentGoalId", "title").sort("-createdAt");
      res.json({ success: true, data: goals });
    } catch (e) { next(e); }
  }

  static async createGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await Goal.create({ ...req.body, userId: req.user!._id });
      if (req.body.userId && req.body.userId.toString() !== req.user!._id.toString()) {
        NotificationService.create({
          recipient: req.body.userId,
          sender: req.user!._id,
          type: "system",
          title: "New goal assigned",
          message: `${req.user!.name} assigned you a goal: ${goal.title || ""}`,
          link: "/performance/goals",
          entityType: "Goal",
          entityId: goal._id,
        }).catch(() => {});
      }
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

  // ── Goal Check-ins ──
  static async addCheckIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await Goal.findById(req.params.id as string);
      if (!goal) { res.status(404).json({ success: false, message: "Goal not found" }); return; }
      const { progress, note } = req.body;
      goal.checkIns.push({ progress, note, createdBy: req.user!._id, createdAt: new Date() });
      goal.progress = progress;
      // Auto-update status based on progress and timeline
      if (progress >= 100) {
        goal.status = "completed";
        goal.completedAt = new Date();
      } else if (goal.dueDate) {
        const now = new Date();
        const start = goal.startDate ? new Date(goal.startDate) : new Date(goal.createdAt);
        const end = new Date(goal.dueDate);
        const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
        const elapsed = (now.getTime() - start.getTime()) / 86400000;
        const expectedProgress = Math.min(100, (elapsed / totalDays) * 100);
        if (progress >= expectedProgress - 10) goal.status = "on-track";
        else if (progress >= expectedProgress - 25) goal.status = "at-risk";
        else goal.status = "behind";
      } else if (progress > 0) {
        goal.status = "on-track";
      }
      await goal.save();
      res.json({ success: true, data: goal });
    } catch (e) { next(e); }
  }

  // ── Goal Milestones Toggle ──
  static async toggleMilestone(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await Goal.findById(req.params.id as string);
      if (!goal) { res.status(404).json({ success: false, message: "Goal not found" }); return; }
      const ms = goal.milestones.id(req.params.milestoneId as string);
      if (!ms) { res.status(404).json({ success: false, message: "Milestone not found" }); return; }
      ms.completed = !ms.completed;
      ms.completedAt = ms.completed ? new Date() : undefined;
      // Recalc progress from milestones if no KPIs
      if (goal.kpis.length === 0 && goal.milestones.length > 0) {
        const done = goal.milestones.filter((m: any) => m.completed).length;
        goal.progress = Math.round((done / goal.milestones.length) * 100);
      }
      await goal.save();
      res.json({ success: true, data: goal });
    } catch (e) { next(e); }
  }

  // ── Team Goals (for managers) ──
  static async getTeamGoals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const User = (await import("../models/User")).default;
      const teamMembers = await User.find({ isActive: true }).select("_id name email department").lean();
      const filter: Record<string, unknown> = { userId: { $in: teamMembers.map((u) => u._id) } };
      if (req.query.period) filter.period = req.query.period;
      if (req.query.year) filter.year = Number(req.query.year);
      if (req.query.category) filter.category = req.query.category;
      const goals = await Goal.find(filter).populate("userId", "name email department").sort("-createdAt");
      res.json({ success: true, data: goals });
    } catch (e) { next(e); }
  }

  // ── Goal Stats ──
  static async getGoalStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.query.userId || req.user!._id;
      const year = Number(req.query.year) || new Date().getFullYear();
      const period = req.query.period as string | undefined;
      const filter: Record<string, unknown> = { userId, year };
      if (period) filter.period = period;
      const goals = await Goal.find(filter).lean();
      const total = goals.length;
      const completed = goals.filter((g) => g.status === "completed").length;
      const onTrack = goals.filter((g) => g.status === "on-track").length;
      const atRisk = goals.filter((g) => g.status === "at-risk").length;
      const behind = goals.filter((g) => g.status === "behind").length;
      const notStarted = goals.filter((g) => g.status === "not-started").length;
      const avgProgress = total > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / total) : 0;
      res.json({ success: true, data: { total, completed, onTrack, atRisk, behind, notStarted, avgProgress } });
    } catch (e) { next(e); }
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
      if (review && (review as any).managerId) {
        NotificationService.create({
          recipient: (review as any).managerId,
          sender: req.user!._id,
          type: "system",
          title: "Self-review submitted",
          message: `${req.user!.name} submitted their self-review`,
          link: `/performance/reviews/${review._id}/mgr`,
          entityType: "Review",
          entityId: review._id,
        }).catch(() => {});
      }
      res.json({ success: true, data: review });
    } catch (e) { next(e); }
  }
  static async submitManagerReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await Review.findByIdAndUpdate(req.params.id as string, { ...req.body, managerSubmittedAt: new Date(), status: "mgr-done" }, { new: true });
      if (review && (review as any).employeeId) {
        NotificationService.create({
          recipient: (review as any).employeeId,
          sender: req.user!._id,
          type: "system",
          title: "Manager review completed",
          message: `${req.user!.name} completed your performance review`,
          link: "/performance/reviews/my",
          entityType: "Review",
          entityId: review._id,
        }).catch(() => {});
      }
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
      if (req.body.toUser && req.body.toUser.toString() !== req.user!._id.toString()) {
        NotificationService.create({
          recipient: req.body.toUser,
          sender: req.body.anonymous ? undefined : req.user!._id,
          type: "system",
          title: "New feedback received",
          message: req.body.anonymous
            ? "You received anonymous feedback"
            : `${req.user!.name} shared feedback with you`,
          link: "/performance/feedback",
          entityType: "Feedback",
          entityId: fb._id,
        }).catch(() => {});
      }
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
      if ((pip as any).employeeId) {
        NotificationService.create({
          recipient: (pip as any).employeeId,
          sender: req.user!._id,
          type: "system",
          title: "Performance improvement plan",
          message: "A Performance Improvement Plan has been created for you. Please review.",
          link: `/performance/pip/${pip._id}`,
          entityType: "PIP",
          entityId: pip._id,
        }).catch(() => {});
      }
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
      NotificationService.notifyAll(
        {
          sender: req.user!._id,
          type: "system",
          title: "New review cycle started",
          message: (cycle as any).name || "A new performance review cycle has been started",
          link: "/performance/reviews/my",
          entityType: "ReviewCycle",
          entityId: cycle._id,
        },
        req.user!._id
      ).catch(() => {});
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
