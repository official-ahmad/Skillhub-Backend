import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("Announcement", announcementSchema);
