import mongoose from "mongoose";

const progressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  course: { type: String, ref: "Course", required: true, index: true },
  completedLessons: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false });
progressSchema.index({ student: 1, course: 1 }, { unique: true });
export default mongoose.model("Progress", progressSchema);
