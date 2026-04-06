import mongoose, { Schema } from "mongoose";

const lastMessageSchema = new Schema(
  {
    text: { type: String },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    name: { type: String },
    lastMessage: lastMessageSchema,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

export default mongoose.model("Conversation", conversationSchema);
