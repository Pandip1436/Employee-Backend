import mongoose, { Schema } from "mongoose";

export interface ICompOff {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  workedDate: Date;
  hoursWorked: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "used" | "expired";
  approvedBy?: mongoose.Types.ObjectId;
  usedDate?: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const compOffSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workedDate: { type: Date, required: true },
    hoursWorked: { type: Number, required: true, min: 4 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "used", "expired"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    usedDate: { type: Date },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

compOffSchema.index({ userId: 1, status: 1 });

export default mongoose.model<ICompOff>("CompOff", compOffSchema);
