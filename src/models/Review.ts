import mongoose, { Schema } from "mongoose";

const goalRatingSchema = new Schema({ goalId: Schema.Types.ObjectId, rating: Number, comment: String }, { _id: false });

const reviewSchema = new Schema(
  {
    cycleId: { type: Schema.Types.ObjectId, ref: "ReviewCycle" },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    managerId: { type: Schema.Types.ObjectId, ref: "User" },
    selfRating: { type: Number, min: 1, max: 5 },
    selfComments: { type: String },
    selfAchievements: { type: String },
    selfChallenges: { type: String },
    selfGoalRatings: [goalRatingSchema],
    selfSubmittedAt: { type: Date },
    managerRating: { type: Number, min: 1, max: 5 },
    managerComments: { type: String },
    managerGoalRatings: [goalRatingSchema],
    managerSubmittedAt: { type: Date },
    finalRating: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: ["pending", "self-done", "mgr-done", "completed"], default: "pending" },
  },
  { timestamps: true }
);

reviewSchema.index({ employeeId: 1, cycleId: 1 });
export default mongoose.model("Review", reviewSchema);
