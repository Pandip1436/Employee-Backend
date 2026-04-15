import Timer from "../models/Timer";
import Timesheet from "../models/Timesheet";
import WeeklyTimesheet from "../models/WeeklyTimesheet";
import { ITimer } from "../types";
import { ApiError } from "../utils/ApiError";

export class TimerService {
  static async start(
    userId: string,
    projectId: string,
    description: string
  ): Promise<ITimer> {
    // Check if there's already a running timer
    const running = await Timer.findOne({ userId, isRunning: true });
    if (running) {
      throw new ApiError(400, "You already have a running timer. Stop it first.");
    }

    const timer = await Timer.create({
      userId,
      projectId,
      description,
      startTime: new Date(),
    });

    return timer;
  }

  static async stop(timerId: string, userId: string): Promise<ITimer> {
    const timer = await Timer.findById(timerId);
    if (!timer) throw new ApiError(404, "Timer not found.");

    if (timer.userId.toString() !== userId) {
      throw new ApiError(403, "You can only stop your own timers.");
    }

    if (!timer.isRunning) {
      throw new ApiError(400, "Timer is already stopped.");
    }

    timer.endTime = new Date();
    timer.isRunning = false;
    timer.duration = parseFloat(
      ((timer.endTime.getTime() - timer.startTime.getTime()) / 3600000).toFixed(2)
    );

    await timer.save();

    // Auto-create a daily timesheet entry from the timer
    await Timesheet.create({
      userId: timer.userId,
      projectId: timer.projectId,
      date: timer.startTime,
      hours: timer.duration,
      description: timer.description,
      status: "draft",
    });

    // Auto-add to weekly timesheet
    await this.addToWeeklyTimesheet(
      timer.userId.toString(),
      timer.projectId.toString(),
      timer.startTime,
      timer.duration,
      timer.description
    );

    return timer;
  }

  private static async addToWeeklyTimesheet(
    userId: string,
    projectId: string,
    startTime: Date,
    duration: number,
    description: string
  ): Promise<void> {
    // Calculate week range (Monday–Sunday)
    const d = new Date(startTime);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Day index: 0=Mon, 6=Sun
    const dayIndex = (day + 6) % 7;

    // Find or create the weekly timesheet
    let sheet = await WeeklyTimesheet.findOne({ userId, weekStart: monday });
    if (!sheet) {
      sheet = await WeeklyTimesheet.create({
        userId,
        weekStart: monday,
        weekEnd: sunday,
        entries: [],
        totalHours: 0,
      });
    }

    // Only add to draft or rejected sheets
    if (sheet.status !== "draft" && sheet.status !== "rejected") return;

    // Find existing entry for the same project
    const existing = sheet.entries.find(
      (e) => e.projectId.toString() === projectId
    );

    if (existing) {
      // Add hours to the correct day
      existing.hours[dayIndex] = parseFloat(
        ((existing.hours[dayIndex] || 0) + duration).toFixed(2)
      );
      if (description && !existing.notes) existing.notes = description;
    } else {
      // Create new entry row
      const hours = [0, 0, 0, 0, 0, 0, 0];
      hours[dayIndex] = duration;
      sheet.entries.push({
        projectId: projectId as any,
        task: description || "General",
        activityType: "Development",
        hours,
        notes: description,
      });
    }

    // Recalculate total hours
    sheet.totalHours = sheet.entries.reduce(
      (sum, e) => sum + e.hours.reduce((s, h) => s + h, 0),
      0
    );

    await sheet.save();
  }

  static async getRunning(userId: string): Promise<ITimer | null> {
    return Timer.findOne({ userId, isRunning: true }).populate(
      "projectId",
      "name client"
    );
  }

  static async getHistory(userId: string): Promise<ITimer[]> {
    return Timer.find({ userId, isRunning: false })
      .populate("projectId", "name client")
      .sort("-endTime")
      .limit(50);
  }
}
