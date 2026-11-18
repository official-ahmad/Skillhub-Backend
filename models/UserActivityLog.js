import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: ["login", "logout", "google_auth", "profile_update"], required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

export default mongoose.model("UserActivityLog", activitySchema);
