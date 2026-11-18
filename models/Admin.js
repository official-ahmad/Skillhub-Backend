import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    adminId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["super_admin"],
      default: "super_admin",
      required: true,
    },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("Admin", adminSchema);
