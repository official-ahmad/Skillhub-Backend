import "./config/environment.js";
import { validateEnvironment } from "./config/environment.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Admin from "./models/Admin.js";

validateEnvironment(["MONGO_URI", "SEED_ADMIN_ID", "SEED_ADMIN_PASSWORD"]);
if (process.env.SEED_ADMIN_PASSWORD.length < 14) {
  throw new Error("SEED_ADMIN_PASSWORD must be at least 14 characters");
}

await mongoose.connect(process.env.MONGO_URI, { dbName: "SkillhubDB" });
const adminId = process.env.SEED_ADMIN_ID.trim().toLowerCase();
const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12);
await Admin.findOneAndUpdate(
  { adminId },
  { $set: { passwordHash, role: "super_admin" } },
  { upsert: true, new: true, runValidators: true },
);
console.log(`Admin ${adminId} seeded successfully.`);
await mongoose.disconnect();
