import mongoose, { Schema } from "mongoose";
import { ITimer } from "../types";

const timerSchema = new Schema<ITimer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number,
    },
    isRunning: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

timerSchema.index({ userId: 1, isRunning: 1 });

export default mongoose.model<ITimer>("Timer", timerSchema);
