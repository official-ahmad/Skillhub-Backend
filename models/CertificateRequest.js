import mongoose from "mongoose";

const certificateRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentName: { type: String, required: true },
    immutableStudentId: { type: String, required: true },
    course: { type: String, required: true, index: true },
    courseTitle: { type: String, required: true },
    requiredXp: { type: Number, required: true, min: 0 },
    currentXp: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

certificateRequestSchema.index({ student: 1, course: 1, status: 1 });

export default mongoose.model("CertificateRequest", certificateRequestSchema);
