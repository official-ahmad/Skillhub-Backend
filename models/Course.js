import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  _id: { type: String },
  title: { type: String, required: true },
  category: { type: String, default: "General" },
  icon: { type: String, default: "📘" },
  colorIndex: { type: Number, default: 0 },
  instructor: { type: String, default: "SkillHub" },
  lessons: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true, versionKey: false });

export default mongoose.model("Course", courseSchema);
