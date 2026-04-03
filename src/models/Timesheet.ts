import mongoose, { Schema } from "mongoose";
import { ITimesheet } from "../types";

const timesheetSchema = new Schema<ITimesheet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    hours: {
      type: Number,
      required: true,
      min: 0.25,
      max: 24,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionComment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

timesheetSchema.index({ userId: 1, date: 1 });
timesheetSchema.index({ projectId: 1 });
timesheetSchema.index({ status: 1 });

export default mongoose.model<ITimesheet>("Timesheet", timesheetSchema);
