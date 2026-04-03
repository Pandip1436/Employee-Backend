import mongoose, { Schema } from "mongoose";

export interface IHoliday {
  _id: mongoose.Types.ObjectId;
  name: string;
  date: Date;
  type: "public" | "restricted" | "company";
  description?: string;
  createdAt: Date;
}

const holidaySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ["public", "restricted", "company"], default: "public" },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1 });

export default mongoose.model<IHoliday>("Holiday", holidaySchema);
