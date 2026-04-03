import mongoose, { Schema } from "mongoose";

export interface ILeave {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "casual" | "sick" | "earned" | "unpaid";
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: mongoose.Types.ObjectId;
  rejectionComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["casual", "sick", "earned", "unpaid"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionComment: { type: String, trim: true },
  },
  { timestamps: true }
);

leaveSchema.index({ userId: 1, status: 1 });

export default mongoose.model<ILeave>("Leave", leaveSchema);
