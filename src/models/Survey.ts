import mongoose, { Schema } from "mongoose";

const questionSchema = new Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ["mcq", "rating", "text"], required: true },
  options: [{ type: String }],
  required: { type: Boolean, default: false },
});

const responseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  anonymous: { type: Boolean, default: false },
  answers: [{ questionIndex: Number, value: Schema.Types.Mixed }],
  submittedAt: { type: Date, default: Date.now },
});

const surveySchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    questions: [questionSchema],
    responses: [responseSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
    deadline: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Survey", surveySchema);
