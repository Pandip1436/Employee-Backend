import mongoose, { Schema } from "mongoose";

const reviewCycleSchema = new Schema(
  {
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    selfDeadline: { type: Date },
    managerDeadline: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("ReviewCycle", reviewCycleSchema);
