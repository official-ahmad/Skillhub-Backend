import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  course: { type: String, ref: "Course", required: true, index: true },
  enrolledAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
export default mongoose.model("Enrollment", enrollmentSchema);
