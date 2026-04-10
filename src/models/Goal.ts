import mongoose, { Schema } from "mongoose";

const kpiSchema = new Schema(
  { name: String, target: Number, current: { type: Number, default: 0 }, unit: String },
  { _id: false }
);

const milestoneSchema = new Schema(
  {
    title: { type: String, required: true },
    dueDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
  },
  { _id: true }
);

const checkInSchema = new Schema(
  {
    progress: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const goalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },

    // Professional fields
    category: {
      type: String,
      enum: ["individual", "team", "company"],
      default: "individual",
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    period: {
      type: String,
      enum: ["Q1", "Q2", "Q3", "Q4", "H1", "H2", "annual"],
      default: "Q1",
    },
    year: { type: Number, default: () => new Date().getFullYear() },
    visibility: {
      type: String,
      enum: ["private", "team", "company"],
      default: "team",
    },
    weightage: { type: Number, default: 1, min: 1, max: 10 },

    // Parent goal alignment
    parentGoalId: { type: Schema.Types.ObjectId, ref: "Goal", default: null },

    // KPIs
    kpis: [kpiSchema],

    // Milestones
    milestones: [milestoneSchema],

    // Check-ins (progress updates)
    checkIns: [checkInSchema],

    // Progress & Status
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["not-started", "on-track", "at-risk", "behind", "completed"],
      default: "not-started",
    },

    dueDate: { type: Date },
    startDate: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

goalSchema.index({ userId: 1, status: 1 });
goalSchema.index({ userId: 1, period: 1, year: 1 });
goalSchema.index({ category: 1, visibility: 1 });

export default mongoose.model("Goal", goalSchema);
