import mongoose, { Schema } from "mongoose";

export interface ITimesheetEntry {
  projectId: mongoose.Types.ObjectId;
  task: string;
  activityType: string;
  hours: number[];  // 7 elements: Mon–Sun
  notes?: string;
}

export interface IWeeklyTimesheet {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  weekStart: Date;   // Monday of the week
  weekEnd: Date;     // Sunday
  entries: ITimesheetEntry[];
  totalHours: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  submittedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  managerComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const timesheetEntrySchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  task: { type: String, default: "General" },
  activityType: { type: String, default: "Development" },
  hours: { type: [Number], default: [0,0,0,0,0,0,0], validate: [(v: number[]) => v.length === 7, "Must have 7 days"] },
  notes: { type: String },
}, { _id: false });

const weeklyTimesheetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    entries: [timesheetEntrySchema],
    totalHours: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "submitted", "approved", "rejected"], default: "draft" },
    submittedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    managerComment: { type: String },
  },
  { timestamps: true }
);

weeklyTimesheetSchema.index({ userId: 1, weekStart: 1 }, { unique: true });
weeklyTimesheetSchema.index({ status: 1 });

export default mongoose.model<IWeeklyTimesheet>("WeeklyTimesheet", weeklyTimesheetSchema);
