import mongoose, { Schema } from "mongoose";

const courseSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    skill: { type: String },
    duration: { type: String },
    instructor: { type: String },
    thumbnail: { type: String },
    link: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    enrolledUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    completedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Course", courseSchema);
