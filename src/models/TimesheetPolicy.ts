import mongoose, { Schema } from "mongoose";

const timesheetPolicySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    label: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("TimesheetPolicy", timesheetPolicySchema);
