import mongoose from "mongoose";

const querySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    adminResponse: { type: String, trim: true, maxlength: 4000, default: "" },
    status: { type: String, enum: ["pending", "resolved"], default: "pending", index: true },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("Query", querySchema);
