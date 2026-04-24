import { Response, NextFunction } from "express";
import Course from "../models/Course";
import Certification from "../models/Certification";
import Training from "../models/Training";
import User from "../models/User";
import { AuthRequest } from "../types";
import { NotificationService } from "../services/notificationService";

export class LearningController {
  // ── Courses ──
  static async getCourses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: Record<string, unknown> = { isActive: true };
      if (req.query.category) filter.category = req.query.category;
      if (req.query.skill) filter.skill = { $regex: req.query.skill, $options: "i" };
      // Employees see only their own courses; managers/admins see all.
      if (req.user!.role === "employee") filter.createdBy = req.user!._id;
      const courses = await Course.find(filter).populate("createdBy", "name").sort("-createdAt");
      res.json({ success: true, data: courses });
    } catch (e) { next(e); }
  }
  static async getCourseById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await Course.findById(req.params.id)
        .populate("createdBy", "name")
        .populate("enrolledUsers", "name email department")
        .populate("completedUsers", "name email department");
      if (!course) { res.status(404).json({ success: false, message: "Course not found" }); return; }
      res.json({ success: true, data: course });
    } catch (e) { next(e); }
  }
  static async createCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await Course.create({ ...req.body, createdBy: req.user!._id });
      NotificationService.notifyAdmins(
        {
          sender: req.user!._id,
          type: "system",
          title: "New course available",
          message: (course as any).title || "Check out the new course on Learning Hub",
          link: `/learning/courses/${course._id}`,
          entityType: "Course",
          entityId: course._id,
        },
        req.user!._id
      ).catch(() => {});
      res.status(201).json({ success: true, data: course });
    } catch (e) { next(e); }
  }
  static async updateCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await Course.findById(req.params.id as string);
      if (!course) { res.status(404).json({ success: false, message: "Course not found" }); return; }
      const isOwner = course.createdBy?.toString() === req.user!._id.toString();
      const isAdminOrMgr = req.user!.role === "admin" || req.user!.role === "manager";
      if (!isOwner && !isAdminOrMgr) { res.status(403).json({ success: false, message: "Not authorized" }); return; }
      const updated = await Course.findByIdAndUpdate(req.params.id as string, req.body, { new: true });
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }
  static async deleteCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await Course.findById(req.params.id as string);
      if (!course) { res.status(404).json({ success: false, message: "Course not found" }); return; }
      const isOwner = course.createdBy?.toString() === req.user!._id.toString();
      const isAdminOrMgr = req.user!.role === "admin" || req.user!.role === "manager";
      if (!isOwner && !isAdminOrMgr) { res.status(403).json({ success: false, message: "Not authorized" }); return; }
      await Course.findByIdAndDelete(req.params.id as string);
      res.json({ success: true });
    } catch (e) { next(e); }
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
      NotificationService.notifyAll(
        {
          sender: req.user!._id,
          type: "system",
          title: "New training scheduled",
          message: `${(training as any).title || "Training"} — ${new Date((training as any).date).toLocaleDateString()}`,
          link: "/learning/calendar",
          entityType: "Training",
          entityId: training._id,
        },
        req.user!._id
      ).catch(() => {});
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

  // Admin: all learners with their enrolled/completed courses
  static async getLearners(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await User.find({ role: { $ne: "admin" }, isActive: true })
        .select("name email department userId")
        .sort("name")
        .lean();

      const courses = await Course.find({ isActive: true })
        .select("title category skill duration enrolledUsers completedUsers")
        .lean();

      type CourseInfo = { _id: string; title: string; category: string; skill: string; duration: string };

      const userMap = new Map<string, { enrolled: CourseInfo[]; completed: CourseInfo[] }>();
      for (const u of users) {
        userMap.set(u._id.toString(), { enrolled: [], completed: [] });
      }

      for (const c of courses) {
        const info: CourseInfo = { _id: c._id.toString(), title: c.title, category: c.category || "", skill: c.skill || "", duration: c.duration || "" };
        for (const uid of c.enrolledUsers || []) {
          const key = uid.toString();
          const entry = userMap.get(key);
          if (entry) entry.enrolled.push(info);
        }
        for (const uid of c.completedUsers || []) {
          const key = uid.toString();
          const entry = userMap.get(key);
          if (entry) entry.completed.push(info);
        }
      }

      const learners = users.map((u) => {
        const data = userMap.get(u._id.toString()) || { enrolled: [], completed: [] };
        const inProgress = data.enrolled.filter(
          (e) => !data.completed.some((c) => c._id === e._id)
        );
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          department: (u as any).department || "",
          userId: (u as any).userId || "",
          enrolledCount: data.enrolled.length,
          completedCount: data.completed.length,
          inProgressCount: inProgress.length,
          enrolled: data.enrolled,
          completed: data.completed,
          inProgress,
        };
      });

      res.json({ success: true, data: learners });
    } catch (e) { next(e); }
  }
}
