import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import Admin from "../models/Admin.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Query from "../models/Query.js";
import UserActivityLog from "../models/UserActivityLog.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Enrollment from "../models/Enrollment.js";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const adminId = String(req.body.adminId || "")
      .trim()
      .toLowerCase(); // Fixed toLowerCase()
    const password = String(req.body.password || "");
    if (!adminId || !password)
      return res
        .status(400)
        .json({ error: "Admin ID and password are required" });
    const admin = await Admin.findOne({ adminId }).select("+passwordHash");
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res
        .status(401)
        .json({ error: "Invalid administrator credentials" });
    }
    const token = jwt.sign(
      { sub: admin.id, role: admin.role },
      process.env.ADMIN_JWT_SECRET,
      {
        expiresIn: "2h",
        issuer: "skillhub-admin",
        audience: "skillhub-admin-portal",
      },
    );
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = req.ip || "";
    await admin.save();
    const secure = process.env.NODE_ENV === "production";
    res.cookie("skillhub_admin", token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "none" : "lax",
      maxAge: 2 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({
      token,
      admin: {
        id: admin.id,
        adminId: admin.adminId,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", verifyAdmin, (req, res) => {
  res.clearCookie("skillhub_admin", {
    path: "/",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ loggedOut: true });
});

router.use(verifyAdmin);

router.get("/overview", async (_req, res, next) => {
  try {
    const [totalStudents, activeCourses, pendingQueries, suspendedAccounts] =
      await Promise.all([
        User.countDocuments(),
        Course.countDocuments(),
        Query.countDocuments({ status: "pending" }),
        User.countDocuments({ isSuspended: true }),
      ]);
    res.json({
      totalStudents,
      activeCourses,
      pendingQueries,
      suspendedAccounts,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { studentId: { $regex: search, $options: "i" } },
          ],
        }
      : {};
    const users = await User.find(filter)
      .select(
        "name email avatar studentId className enrolledCourses progress isSuspended createdAt updatedAt",
      )
      .lean();
    const ids = users.map((user) => user._id);
    const [enrollments, latestLogs] = await Promise.all([
      Enrollment.find({ student: { $in: ids } })
        .populate("course", "_id title")
        .lean(),
      UserActivityLog.aggregate([
        { $match: { user: { $in: ids } } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: "$user",
            loginCount: {
              $sum: { $cond: [{ $eq: ["$action", "login"] }, 1, 0] },
            },
            lastLogin: {
              $first: {
                $cond: [{ $eq: ["$action", "login"] }, "$timestamp", null],
              },
            },
            lastLogout: {
              $max: {
                $cond: [{ $eq: ["$action", "logout"] }, "$timestamp", null],
              },
            },
          },
        },
      ]),
    ]);
    const enrollmentByUser = new Map();
    enrollments.forEach((entry) =>
      enrollmentByUser.set(String(entry.student), [
        ...(enrollmentByUser.get(String(entry.student)) || []),
        entry.course,
      ]),
    );
    const logByUser = new Map(
      latestLogs.map((entry) => [String(entry._id), entry]),
    );
    res.json(
      users.map((user) => ({
        ...user,
        courses: enrollmentByUser.get(String(user._id)) || [],
        activity: logByUser.get(String(user._id)) || {
          loginCount: 0,
          lastLogin: null,
          lastLogout: null,
        },
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/suspend", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Student not found" });
    user.isSuspended =
      typeof req.body.isSuspended === "boolean"
        ? req.body.isSuspended
        : !user.isSuspended;
    await user.save();
    res.json({
      user: { id: user.id, name: user.name, isSuspended: user.isSuspended },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users/:id/logs", async (req, res, next) => {
  try {
    const logs = await UserActivityLog.find({ user: req.params.id })
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();
    res.json({
      loginCount: logs.filter((entry) => entry.action === "login").length,
      logs,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/queries", async (_req, res, next) => {
  try {
    const queries = await Query.find()
      .populate("userId", "name email avatar studentId")
      .sort({ createdAt: -1 })
      .lean();
    res.json(queries);
  } catch (error) {
    next(error);
  }
});

router.patch("/queries/:id", async (req, res, next) => {
  try {
    const response = String(req.body.adminResponse || "").trim();
    if (!response)
      return res.status(400).json({ error: "A response is required" });
    const query = await Query.findByIdAndUpdate(
      req.params.id,
      { adminResponse: response, status: "resolved" },
      { new: true, runValidators: true },
    ).populate("userId", "name email");
    if (!query) return res.status(404).json({ error: "Query not found" });
    res.json(query);
  } catch (error) {
    next(error);
  }
});

export default router;
