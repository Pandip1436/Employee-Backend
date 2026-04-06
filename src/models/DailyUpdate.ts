import mongoose, { Schema } from "mongoose";

export type DailyUpdateStatus = "completed" | "in-progress" | "blocked";

export interface IDailyUpdate {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  tasks: string;
  links: string;
  status: DailyUpdateStatus;
  proof?: string;
  planForTomorrow: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewComment?: string;
  reviewStatus?: "reviewed" | "needs-improvement";
  createdAt: Date;
  updatedAt: Date;
}

const dailyUpdateSchema = new Schema<IDailyUpdate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    tasks: { type: String, required: true, trim: true },
    links: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["completed", "in-progress", "blocked"],
      required: true,
    },
    proof: { type: String, trim: true },
    planForTomorrow: { type: String, required: true, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewComment: { type: String, trim: true },
    reviewStatus: {
      type: String,
      enum: ["reviewed", "needs-improvement"],
    },
  },
  { timestamps: true }
);

dailyUpdateSchema.index({ userId: 1, date: -1 });
dailyUpdateSchema.index({ date: -1 });

export default mongoose.model<IDailyUpdate>("DailyUpdate", dailyUpdateSchema);
