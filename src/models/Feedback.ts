import mongoose, { Schema } from "mongoose";

const feedbackSchema = new Schema(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: "User" },
    toUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["peer", "subordinate", "manager"], default: "peer" },
    rating: { type: Number, min: 1, max: 5 },
    strengths: { type: String },
    improvements: { type: String },
    comments: { type: String },
    anonymous: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Feedback", feedbackSchema);
