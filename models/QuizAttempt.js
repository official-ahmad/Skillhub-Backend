import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: String, required: true, index: true },
    kind: { type: String, enum: ["lesson", "marathon"], required: true, index: true },
    lessonIndex: { type: Number, default: -1 },
    questionIds: { type: [String], required: true },
    questions: {
      type: [
        new mongoose.Schema(
          {
            questionId: { type: String, required: true },
            question: { type: String, required: true },
            options: { type: [String], required: true },
            correctIndex: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      required: true,
    },
    status: { type: String, enum: ["active", "graded", "expired", "superseded"], default: "active", index: true },
    expiresAt: { type: Date, default: null },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false },
);

quizAttemptSchema.index({ student: 1, course: 1, kind: 1, lessonIndex: 1, createdAt: -1 });
quizAttemptSchema.index({ student: 1, course: 1, kind: 1, status: 1 });

export default mongoose.model("QuizAttempt", quizAttemptSchema);
