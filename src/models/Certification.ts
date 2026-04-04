import mongoose, { Schema } from "mongoose";

const certificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    name: { type: String, required: true },
    issuer: { type: String },
    completedDate: { type: Date },
    certificatePath: { type: String },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Certification", certificationSchema);
