import mongoose from "mongoose";

const technologySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 80 },
    description: { type: String, trim: true, default: "", maxlength: 500 },
    image: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "General", maxlength: 80 },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("Technology", technologySchema);
