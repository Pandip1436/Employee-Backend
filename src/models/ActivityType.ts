import mongoose, { Schema } from "mongoose";

const activityTypeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("ActivityType", activityTypeSchema);
