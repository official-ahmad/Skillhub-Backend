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
    xpBalance: { type: Number, min: 0, default: 0 },
    className: { type: String, trim: true, default: "" },
    accountType: {
      type: String,
      enum: ["student", "instructor", "staff", "guest"],
      default: "student",
    },
    role: {
      type: String,
      enum: ["student", "instructor", "staff", "guest"],
      default: "student",
    },
    isActive: { type: Boolean, default: true, index: true },
    passwordHash: { type: String, select: false, default: null },
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

userSchema.index({ studentId: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ className: 1, accountType: 1, isSuspended: 1, createdAt: -1 });

userSchema.set("toJSON", {
  transform: (_doc, value) => {
    delete value.googleId;
    return value;
  },
});
export default mongoose.model("User", userSchema);
