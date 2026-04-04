import mongoose, { Schema } from "mongoose";

const pipGoalSchema = new Schema({ title: String, targetDate: Date, status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" }, managerComment: String }, { _id: false });

const pipSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    managerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    goals: [pipGoalSchema],
    status: { type: String, enum: ["active", "completed", "extended", "terminated"], default: "active" },
    managerNotes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("PIP", pipSchema);
