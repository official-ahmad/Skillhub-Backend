import "./config/environment.js";
import { validateEnvironment } from "./config/environment.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import progressRoutes from "./routes/progress.js";
import studentRoutes from "./routes/students.js";
import adminRoutes from "./routes/admin.js";
import queryRoutes from "./routes/queries.js";
import technologyRoutes from "./routes/technologies.js";
import cookieParser from "cookie-parser";
import announcementRoutes from "./routes/announcements.js";
import certificateRoutes from "./routes/certificates.js";
import compression from "compression";

validateEnvironment([
  "MONGO_URI",
  "JWT_SECRET",
  "ADMIN_JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "FRONTEND_URL",
  "PORT",
]);
if (process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET must be at least 32 characters");
if (process.env.ADMIN_JWT_SECRET.length < 32)
  throw new Error("ADMIN_JWT_SECRET must be at least 32 characters");

const app = express();
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");
const allowedOrigins = new Set([
  "http://localhost:5173",
  ...process.env.FRONTEND_URL.split(",").map(normalizeOrigin).filter(Boolean),
]);
const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = origin ? normalizeOrigin(origin) : "";
    if (!origin || allowedOrigins.has(normalizedOrigin))
      return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};
app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("combined"));
app.get("/", (_req, res) =>
  res.json({ status: "OK", service: "Skillhub API" }),
);
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/technologies", technologyRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/certificates", certificateRoutes);
app.use((req, res) =>
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }),
);
app.use((error, _req, res, _next) => {
  if (error.message === "Origin is not allowed by CORS")
    return res.status(403).json({ error: error.message });
  if (error.name === "ValidationError")
    return res.status(400).json({ error: error.message });
  if (error.code === 11000)
    return res
      .status(409)
      .json({ error: "An account with this email already exists" });
  console.error(error);
  res.status(error.status || 500).json({
    error:
      error.status && error.status < 500
        ? error.message
        : "Internal server error",
  });
});

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be a valid TCP port in the backend .env file");
await mongoose.connect(process.env.MONGO_URI, { dbName: "SkillhubDB" });
app.listen(port, "0.0.0.0", () =>
  console.log(`Skillhub API listening on ${port}`),
);
