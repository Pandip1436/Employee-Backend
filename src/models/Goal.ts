import mongoose, { Schema } from "mongoose";

const kpiSchema = new Schema({ name: String, target: Number, current: { type: Number, default: 0 }, unit: String }, { _id: false });

const goalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    kpis: [kpiSchema],
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ["on-track", "at-risk", "completed", "not-started"], default: "not-started" },
    dueDate: { type: Date },
    createdAt: Date,
    updatedAt: Date,
  },
  { timestamps: true }
);

goalSchema.index({ userId: 1, status: 1 });
export default mongoose.model("Goal", goalSchema);
