import Timer from "../models/Timer";
import Timesheet from "../models/Timesheet";
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

    // Auto-create a timesheet entry from the timer
    await Timesheet.create({
      userId: timer.userId,
      projectId: timer.projectId,
      date: timer.startTime,
      hours: timer.duration,
      description: timer.description,
      status: "draft",
    });

    return timer;
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
