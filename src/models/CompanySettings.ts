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
    attendancePolicy: {
      officeStartTime: { type: String, default: "09:00" }, // "HH:MM" in company timezone
      graceMinutes: { type: Number, default: 0 },
      autoClockOutTime: { type: String, default: "19:00" }, // "HH:MM" in company timezone, runs Mon–Sat
      autoMarkAbsentTime: { type: String, default: "01:00" }, // "HH:MM" in company timezone, runs daily — marks previous day
    },
    notificationEmails: { type: [String], default: [] }, // recipients for clock-in/out & late alerts

    emailTemplates: [{
      key: { type: String },
      subject: { type: String },
      body: { type: String },
    }],
  },
  { timestamps: true }
);

export default mongoose.model("CompanySettings", companySettingsSchema);
