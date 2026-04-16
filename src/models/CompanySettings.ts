import mongoose, { Schema } from "mongoose";

const companySettingsSchema = new Schema(
  {
    companyName: { type: String, default: "United Nexa Tech" },
    logo: { type: String },
    timezone: { type: String, default: "Asia/Kolkata" },
    fiscalYearStart: { type: String, default: "April" },
    workingDays: { type: [String], default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
    departments: [{ name: String, description: { type: String, default: "" } }],
    designations: [{ name: String, level: Number, grade: String }],
    roles: [{
      name: { type: String },
      description: { type: String, default: "" },
      permissions: [{ type: String }],
    }],
    leavePolicy: {
      casual: { total: { type: Number, default: 12 }, carryForward: { type: Boolean, default: false } },
      sick: { total: { type: Number, default: 10 }, carryForward: { type: Boolean, default: false } },
      earned: { total: { type: Number, default: 15 }, carryForward: { type: Boolean, default: true }, maxCarry: { type: Number, default: 5 } },
    },
    emailTemplates: [{
      key: { type: String },
      subject: { type: String },
      body: { type: String },
    }],
  },
  { timestamps: true }
);

export default mongoose.model("CompanySettings", companySettingsSchema);
