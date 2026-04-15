import mongoose, { Schema } from "mongoose";

export interface ICompOff {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  workedDate: Date;
  dayOffDate: Date;
  dayType: "full" | "half";
  hoursWorked: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "used" | "expired" | "cancelled";
  approvedBy?: mongoose.Types.ObjectId;
  rejectionComment?: string;
  usedDate?: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const compOffSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workedDate: { type: Date, required: true },
    dayOffDate: { type: Date, required: true },
    dayType: { type: String, enum: ["full", "half"], default: "full" },
    hoursWorked: { type: Number, required: true, min: 4 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "used", "expired", "cancelled"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionComment: { type: String, trim: true },
    usedDate: { type: Date },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

compOffSchema.index({ userId: 1, status: 1 });

export default mongoose.model<ICompOff>("CompOff", compOffSchema);
