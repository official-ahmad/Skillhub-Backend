import mongoose from "mongoose";

const xpTransactionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transactionId: { type: String, required: true, unique: true },
    type: { type: String, enum: ["lesson", "quiz", "certificate"], required: true },
    amount: { type: Number, required: true },
    course: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("XpTransaction", xpTransactionSchema);
