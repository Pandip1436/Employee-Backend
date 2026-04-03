import mongoose from "mongoose";
import Timesheet from "../models/Timesheet";

export class ReportService {
  static async getEmployeeReport(query: {
    userId?: string;
    startDate: string;
    endDate: string;
  }) {
    const match: Record<string, unknown> = {
      status: { $in: ["submitted", "approved"] },
      date: {
        $gte: new Date(query.startDate),
        $lte: new Date(query.endDate),
      },
    };

    if (query.userId) {
      match.userId = new mongoose.Types.ObjectId(query.userId);
    }

    const report = await Timesheet.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$userId",
          totalHours: { $sum: "$hours" },
          totalEntries: { $sum: 1 },
          approvedHours: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$hours", 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          userName: "$user.name",
          email: "$user.email",
          totalHours: { $round: ["$totalHours", 2] },
          approvedHours: { $round: ["$approvedHours", 2] },
          totalEntries: 1,
        },
      },
      { $sort: { totalHours: -1 } },
    ]);

    return report;
  }

  static async getProjectReport(query: {
    projectId?: string;
    startDate: string;
    endDate: string;
  }) {
    const match: Record<string, unknown> = {
      status: { $in: ["submitted", "approved"] },
      date: {
        $gte: new Date(query.startDate),
        $lte: new Date(query.endDate),
      },
    };

    if (query.projectId) {
      match.projectId = new mongoose.Types.ObjectId(query.projectId);
    }

    const report = await Timesheet.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$projectId",
          totalHours: { $sum: "$hours" },
          totalEntries: { $sum: 1 },
          uniqueEmployees: { $addToSet: "$userId" },
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      {
        $project: {
          _id: 0,
          projectId: "$_id",
          projectName: "$project.name",
          client: "$project.client",
          totalHours: { $round: ["$totalHours", 2] },
          totalEntries: 1,
          employeeCount: { $size: "$uniqueEmployees" },
        },
      },
      { $sort: { totalHours: -1 } },
    ]);

    return report;
  }

  static async getWeeklySummary(userId: string) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const dailyBreakdown = await Timesheet.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: weekStart, $lte: weekEnd },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalHours: { $sum: "$hours" },
          entries: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalHours = dailyBreakdown.reduce(
      (sum, day) => sum + day.totalHours,
      0
    );

    return {
      weekStart,
      weekEnd,
      totalHours: parseFloat(totalHours.toFixed(2)),
      dailyBreakdown,
    };
  }
}
