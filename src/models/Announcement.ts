import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, enum: ["all", "hr", "team", "important"], default: "all" },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetAudience: { type: String, enum: ["all", "department", "role"], default: "all" },
    targetValue: { type: String },
    tags: [{ type: String }],
    attachments: [{ type: String }],
    reactions: {
      like: [{ type: Schema.Types.ObjectId, ref: "User" }],
      love: [{ type: Schema.Types.ObjectId, ref: "User" }],
      celebrate: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    comments: [commentSchema],
    isPinned: { type: Boolean, default: false },
    scheduledAt: { type: Date },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ category: 1 });

export default mongoose.model("Announcement", announcementSchema);
