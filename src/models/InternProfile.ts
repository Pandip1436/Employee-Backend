import mongoose, { Schema } from "mongoose";
import { IInternProfile } from "../types";

// Internship-specific data for a user whose role is "intern". Kept separate from
// EmployeeProfile so an intern converted to an employee keeps both records intact.
const internProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // Academic
    college: { type: String, trim: true },
    degree: { type: String, trim: true },
    courseYear: { type: String, trim: true },

    // Supervision
    mentorId: { type: Schema.Types.ObjectId, ref: "User" },

    // Internship term
    startDate: { type: String },
    endDate: { type: String },
    durationMonths: { type: Number, min: 0 },
    stipend: { type: Number, min: 0 },
    internshipType: {
      type: String,
      enum: ["full-time", "part-time"],
      default: "full-time",
    },

    // Lifecycle
    status: {
      type: String,
      enum: ["active", "completed", "terminated", "converted"],
      default: "active",
    },
    conversionDate: { type: String },

    // Completion certificate. certificateIssued flips true the first time a
    // certificate is emailed; the number is minted once so re-sends carry the
    // same reference as the copy already in the intern's inbox.
    certificateIssued: { type: Boolean, default: false },
    certificateNo: { type: String, trim: true },
    certificateIssuedAt: { type: String },
    certificateSentAt: { type: Date },
    certificateSentTo: { type: String, trim: true },

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

internProfileSchema.index({ status: 1 });
internProfileSchema.index({ mentorId: 1 });
internProfileSchema.index({ endDate: 1 });

export default mongoose.model<IInternProfile>("InternProfile", internProfileSchema);
