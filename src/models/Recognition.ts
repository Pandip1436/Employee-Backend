import mongoose, { Schema } from "mongoose";

const recognitionSchema = new Schema(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    toUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    badge: { type: String, enum: ["star-performer", "team-player", "innovator", "mentor", "go-getter", "helping-hand"], required: true },
    reactions: {
      like: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    comments: [{
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      text: { type: String },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

export default mongoose.model("Recognition", recognitionSchema);
