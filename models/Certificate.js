import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    verificationId: { type: String, required: true, unique: true, index: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentName: { type: String, required: true },
    immutableStudentId: { type: String, required: true },
    course: { type: String, required: true, index: true },
    courseTitle: { type: String, required: true },
    requiredXp: { type: Number, required: true, min: 0 },
    xpEarned: { type: Number, required: true, min: 0 },
    xpUsed: { type: Number, required: true, min: 0, default: 0 },
    badgeName: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

certificateSchema.index({ student: 1, course: 1 }, { unique: true });

export default mongoose.model("Certificate", certificateSchema);
