import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import progressRoutes from "./routes/progress.js";

for (const key of ["MONGO_URI", "JWT_SECRET", "GOOGLE_CLIENT_ID"]) {
  if (!process.env[key]) throw new Error(`${key} must be configured`);
}
if (process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");

const app = express();
const allowedOrigins = new Set(["http://localhost:5173", ...String(process.env.FRONTEND_URL || "").split(",").map((value) => value.trim()).filter(Boolean)]);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.has(origin)) return callback(null, true); callback(new Error("Origin is not allowed by CORS")); }, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));
app.get("/", (_req, res) => res.json({ status: "OK", service: "Skillhub API" }));
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/progress", progressRoutes);
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));
app.use((error, _req, res, _next) => {
  if (error.message === "Origin is not allowed by CORS") return res.status(403).json({ error: error.message });
  if (error.name === "ValidationError") return res.status(400).json({ error: error.message });
  if (error.code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
  console.error(error);
  res.status(error.status || 500).json({ error: error.status && error.status < 500 ? error.message : "Internal server error" });
});

const port = Number(process.env.PORT) || 8005;
await mongoose.connect(process.env.MONGO_URI);
app.listen(port, "0.0.0.0", () => console.log(`Skillhub API listening on ${port}`));
