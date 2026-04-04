import { Response, NextFunction } from "express";
import Course from "../models/Course";
import Certification from "../models/Certification";
import Training from "../models/Training";
import { AuthRequest } from "../types";

export class LearningController {
  // ── Courses ──
  static async getCourses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: Record<string, unknown> = { isActive: true };
      if (req.query.category) filter.category = req.query.category;
      if (req.query.skill) filter.skill = { $regex: req.query.skill, $options: "i" };
      const courses = await Course.find(filter).populate("createdBy", "name").sort("-createdAt");
      res.json({ success: true, data: courses });
    } catch (e) { next(e); }
  }
  static async createCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await Course.create({ ...req.body, createdBy: req.user!._id });
      res.status(201).json({ success: true, data: course });
    } catch (e) { next(e); }
  }
  static async updateCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await Course.findByIdAndUpdate(req.params.id as string, req.body, { new: true });
      res.json({ success: true, data: course });
    } catch (e) { next(e); }
  }
  static async deleteCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { await Course.findByIdAndDelete(req.params.id as string); res.json({ success: true }); } catch (e) { next(e); }
  }
  static async enrollCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await Course.findByIdAndUpdate(req.params.id as string, { $addToSet: { enrolledUsers: req.user!._id } });
      res.json({ success: true, message: "Enrolled." });
    } catch (e) { next(e); }
  }
  static async completeCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await Course.findByIdAndUpdate(req.params.id as string, { $addToSet: { completedUsers: req.user!._id } });
      res.json({ success: true, message: "Marked complete." });
    } catch (e) { next(e); }
  }

  // ── Certifications ──
  static async getMyCertifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const certs = await Certification.find({ userId: req.user!._id }).populate("courseId", "title").sort("-completedDate");
      res.json({ success: true, data: certs });
    } catch (e) { next(e); }
  }
  static async addCertification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cert = await Certification.create({ ...req.body, userId: req.user!._id });
      res.status(201).json({ success: true, data: cert });
    } catch (e) { next(e); }
  }

  // ── Training ──
  static async getTrainings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const trainings = await Training.find().populate("conductedBy", "name email").sort("-date");
      res.json({ success: true, data: trainings });
    } catch (e) { next(e); }
  }
  static async createTraining(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const training = await Training.create({ ...req.body, conductedBy: req.user!._id });
      res.status(201).json({ success: true, data: training });
    } catch (e) { next(e); }
  }
  static async getCalendar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const now = new Date();
      const trainings = await Training.find({ date: { $gte: now } }).populate("conductedBy", "name").sort("date").limit(20);
      res.json({ success: true, data: trainings });
    } catch (e) { next(e); }
  }
}
