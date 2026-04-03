import mongoose, { Schema } from "mongoose";

export interface IDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  originalName: string;
  category: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedBy: mongoose.Types.ObjectId;
  access: "all" | "admin" | "hr";
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    category: {
      type: String,
      enum: ["hr-docs", "policies", "employee-files", "templates", "other"],
      default: "other",
    },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    access: {
      type: String,
      enum: ["all", "admin", "hr"],
      default: "all",
    },
  },
  { timestamps: true }
);

documentSchema.index({ category: 1 });
documentSchema.index({ uploadedBy: 1 });

export default mongoose.model<IDocument>("Document", documentSchema);
