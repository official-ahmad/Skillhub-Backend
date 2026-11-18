import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    avatar: { type: String, default: "" },
    studentId: { type: String, trim: true, default: "" },
    className: { type: String, trim: true, default: "" },
    cohort: { type: String, trim: true, default: "" },
    enrolledCourses: { type: [String], default: [] },
    progress: { type: Map, of: Number, default: {} },
    notes: { type: Map, of: String, default: {} },
    bookmarks: { type: [String], default: [] },
    legacyMigratedAt: { type: Date, default: null },
    isSuspended: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

userSchema.set("toJSON", {
  transform: (_doc, value) => {
    delete value.googleId;
    return value;
  },
});
export default mongoose.model("User", userSchema);
