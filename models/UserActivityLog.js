import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true, default: null },
    action: { type: String, enum: ["login", "logout", "google_auth", "profile_update", "course_enrollment", "progress_reset", "account_status", "announcement", "bulk_import", "query_delete", "admin_action"], required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    actor: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

export default mongoose.model("UserActivityLog", activitySchema);
