import mongoose, { Schema } from "mongoose";

export interface ICompOff {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  workedDate: Date;
  reason: string;
  status: "pending" | "approved" | "rejected" | "used";
  approvedBy?: mongoose.Types.ObjectId;
  usedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const compOffSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workedDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "used"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    usedDate: { type: Date },
  },
  { timestamps: true }
);

compOffSchema.index({ userId: 1, status: 1 });

export default mongoose.model<ICompOff>("CompOff", compOffSchema);
