import mongoose, { Schema } from "mongoose";

const trainingSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    conductedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    duration: { type: String },
    materials: [{ type: String }],
    type: { type: String, enum: ["workshop", "webinar", "classroom", "online"], default: "online" },
    attendees: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Training", trainingSchema);
