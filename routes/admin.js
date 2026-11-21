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
import Progress from "../models/Progress.js";
import Technology from "../models/Technology.js";
import { sendWelcomeEmail } from "../services/mailer.js";
import { adminCookieOptions, clearAdminCookieOptions } from "../config/adminCookie.js";
import Announcement from "../models/Announcement.js";

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
    if (!admin.isActive) return res.status(403).json({ error: "This administrator account is inactive." });
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
    res.cookie("skillhub_admin", token, adminCookieOptions);
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
  res.clearCookie("skillhub_admin", clearAdminCookieOptions);
  res.json({ loggedOut: true });
});

router.use(verifyAdmin);

router.get("/admins", async (_req, res, next) => {
  try {
    const admins = await Admin.find().select("adminId role isActive lastLoginAt lastLoginIp createdAt").lean();
    res.json(admins);
  } catch (error) { next(error); }
});

router.patch("/admins/:id/status", async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Administrator not found" });
    if (req.admin.id === admin.id) return res.status(400).json({ message: "You cannot suspend or delete your own admin account." });
    if (process.env.ADMIN_ID && admin.adminId.toLowerCase() === process.env.ADMIN_ID.trim().toLowerCase()) {
      return res.status(400).json({ message: "Cannot suspend or deactivate the protected primary administrator." });
    }
    const isActive = typeof req.body.isActive === "boolean" ? req.body.isActive : admin.isActive;
    if (admin.isActive && !isActive) {
      const remaining = await Admin.countDocuments({ isActive: true, _id: { $ne: admin._id } });
      if (remaining < 1) return res.status(400).json({ message: "Cannot remove or suspend the last active administrator." });
    }
    admin.isActive = isActive;
    await admin.save();
    res.json({ id: admin.id, adminId: admin.adminId, isActive: admin.isActive });
  } catch (error) { next(error); }
});

router.delete("/admins/:id", async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Administrator not found" });
    if (req.admin.id === admin.id) return res.status(400).json({ message: "You cannot suspend or delete your own admin account." });
    if (process.env.ADMIN_ID && admin.adminId.toLowerCase() === process.env.ADMIN_ID.trim().toLowerCase()) {
      return res.status(400).json({ message: "Cannot delete the protected primary administrator." });
    }
    const remaining = await Admin.countDocuments({ isActive: true, _id: { $ne: admin._id } });
    if (remaining < 1) return res.status(400).json({ message: "Cannot remove or suspend the last active administrator." });
    await admin.deleteOne();
    res.json({ deleted: true, id: admin.id });
  } catch (error) { next(error); }
});

router.post("/users", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const accountType = String(req.body.accountType || "student").trim().toLowerCase();
    const studentId = String(req.body.studentId || "").trim();
    const className = String(req.body.className || "").trim();
    const password = String(req.body.password || "");
    if (name.length < 2 || name.length > 120)
      return res.status(400).json({ error: "Name must be between 2 and 120 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return res.status(400).json({ error: "Enter a valid email address" });
    if (!["student", "instructor", "staff", "guest"].includes(accountType))
      return res.status(400).json({ error: "Choose a supported account type" });
    if (studentId.length > 80 || className.length > 120)
      return res.status(400).json({ error: "Student ID or class name is too long" });
    if (password && password.length < 12)
      return res.status(400).json({ error: "The optional account password must be at least 12 characters" });
    if (await User.exists({ email }))
      return res.status(409).json({ error: "A user with this email already exists" });

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const user = await User.create({ name, email, accountType, studentId, className, passwordHash });
    const emailResult = await sendWelcomeEmail({ name, email, accountType });
    res.status(201).json({
      user: user.toJSON(),
      welcomeEmail: emailResult,
      message: emailResult.status === "sent"
        ? "User created and welcome email sent"
        : `User created. ${emailResult.message}`,
    });
  } catch (error) {
    next(error);
  }
});

const normalizeCourseInput = (body) => {
  const title = String(body.title || "").trim();
  const category = String(body.category || "").trim();
  if (title.length < 2 || title.length > 160) throw Object.assign(new Error("Course title must be between 2 and 160 characters"), { status: 400 });
  if (category.length < 2 || category.length > 80) throw Object.assign(new Error("Category must be between 2 and 80 characters"), { status: 400 });
  if (body.lessons !== undefined && (!Array.isArray(body.lessons) || body.lessons.length > 500)) throw Object.assign(new Error("Lessons must be an array with no more than 500 entries"), { status: 400 });
  return {
    title,
    category,
    description: String(body.description || "").trim().slice(0, 2000),
    level: String(body.level || "Beginner").trim().slice(0, 40),
    instructor: String(body.instructor || "Skillhub").trim().slice(0, 120),
    instructorPhoto: String(body.instructorPhoto || "").trim().slice(0, 500),
    instructorUrl: String(body.instructorUrl || "").trim().slice(0, 500),
    instructorUrlVerified: Boolean(body.instructorUrlVerified),
    image: String(body.image || "").trim().slice(0, 500),
    tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
    icon: String(body.icon || "code").trim().slice(0, 80),
    colorIndex: Number.isFinite(Number(body.colorIndex)) ? Number(body.colorIndex) : 0,
    duration: Number.isFinite(Number(body.duration)) ? Math.max(0, Number(body.duration)) : 0,
    lessons: Array.isArray(body.lessons) ? body.lessons : [],
  };
};

const makeCourseId = (title) => title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

router.post("/courses", async (req, res, next) => {
  try {
    const data = normalizeCourseInput(req.body);
    const id = String(req.body.id || makeCourseId(data.title)).trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) return res.status(400).json({ error: "Course ID may contain letters, numbers, underscores, and hyphens" });
    const course = await Course.create({ _id: id, ...data });
    res.status(201).json(course);
  } catch (error) { next(error); }
});

router.patch("/courses/:id", async (req, res, next) => {
  try {
    const data = normalizeCourseInput(req.body);
    const course = await Course.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) { next(error); }
});

router.delete("/courses/:id", async (req, res, next) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    await Promise.all([
      Enrollment.deleteMany({ course: req.params.id }),
      Progress.deleteMany({ course: req.params.id }),
      User.updateMany({}, { $pull: { enrolledCourses: req.params.id }, $unset: { [`progress.${req.params.id}`]: "", [`notes.${req.params.id}`]: "" } }),
    ]);
    res.json({ deleted: true, id: req.params.id });
  } catch (error) { next(error); }
});

router.get("/technologies", async (_req, res, next) => {
  try { res.json(await Technology.find().sort({ category: 1, name: 1 }).lean()); }
  catch (error) { next(error); }
});

router.post("/technologies", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Technology name must be between 2 and 80 characters" });
    const technology = await Technology.create({ name, category: String(req.body.category || "General").trim().slice(0, 80), description: String(req.body.description || "").trim().slice(0, 500), image: String(req.body.image || "").trim().slice(0, 500) });
    res.status(201).json(technology);
  } catch (error) { next(error); }
});

router.patch("/technologies/:id", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Technology name must be between 2 and 80 characters" });
    const technology = await Technology.findByIdAndUpdate(req.params.id, { name, category: String(req.body.category || "General").trim().slice(0, 80), description: String(req.body.description || "").trim().slice(0, 500), image: String(req.body.image || "").trim().slice(0, 500) }, { new: true, runValidators: true });
    if (!technology) return res.status(404).json({ error: "Technology not found" });
    res.json(technology);
  } catch (error) { next(error); }
});

router.delete("/technologies/:id", async (req, res, next) => {
  try {
    const technology = await Technology.findByIdAndDelete(req.params.id);
    if (!technology) return res.status(404).json({ error: "Technology not found" });
    res.json({ deleted: true, id: req.params.id });
  } catch (error) { next(error); }
});

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
        "name email avatar studentId className accountType enrolledCourses progress isSuspended createdAt updatedAt",
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
    if (req.admin?.id === req.params.id) return res.status(400).json({ message: "You cannot suspend or delete your own admin account." });
    const primaryAdminId = String(process.env.ADMIN_ID || "").trim().toLowerCase();
    if (primaryAdminId && (user.email.toLowerCase() === primaryAdminId || user.studentId.toLowerCase() === primaryAdminId || user._id.toString() === primaryAdminId)) {
      return res.status(400).json({ message: "Cannot suspend the protected primary administrator." });
    }
    user.isSuspended =
      typeof req.body.isSuspended === "boolean"
        ? req.body.isSuspended
        : !user.isSuspended;
    await user.save();
    await UserActivityLog.create({
      user: user._id,
      action: "account_status",
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
      metadata: { isSuspended: user.isSuspended },
      actor: req.admin?.adminId || "administrator",
    });
    res.json({
      user: { id: user.id, name: user.name, isSuspended: user.isSuspended },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const name = req.body.name !== undefined ? String(req.body.name).trim() : user.name;
    const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : user.email;
    const accountType = req.body.accountType !== undefined ? String(req.body.accountType).trim().toLowerCase() : user.accountType;
    const studentId = req.body.studentId !== undefined ? String(req.body.studentId).trim() : user.studentId;
    const className = req.body.className !== undefined ? String(req.body.className).trim() : user.className;
    const password = req.body.password !== undefined ? String(req.body.password) : "";

    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Name must be between 2 and 120 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address" });
    if (!["student", "instructor", "staff", "guest"].includes(accountType)) return res.status(400).json({ error: "Choose a supported account type" });
    if (studentId.length > 80 || className.length > 120) return res.status(400).json({ error: "Student ID or class name is too long" });
    if (password && password.length < 12) return res.status(400).json({ error: "Password must be at least 12 characters" });

    if (email !== user.email && await User.exists({ email, _id: { $ne: user._id } })) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    user.name = name;
    user.email = email;
    user.accountType = accountType;
    user.studentId = studentId;
    user.className = className;
    if (typeof req.body.isSuspended === "boolean") user.isSuspended = req.body.isSuspended;
    if (password) user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    const updated = await User.findById(user._id).select("name email avatar studentId className accountType isSuspended createdAt updatedAt").lean();
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (req.admin?.id === req.params.id) return res.status(400).json({ message: "You cannot suspend or delete your own admin account." });
    const primaryAdminId = String(process.env.ADMIN_ID || "").trim().toLowerCase();
    if (primaryAdminId && (user.email.toLowerCase() === primaryAdminId || user.studentId.toLowerCase() === primaryAdminId || user._id.toString() === primaryAdminId)) {
      return res.status(400).json({ message: "Cannot delete the protected primary administrator." });
    }

    await Promise.all([
      Enrollment.deleteMany({ student: user._id }),
      Progress.deleteMany({ student: user._id }),
      UserActivityLog.deleteMany({ user: user._id }),
      Query.deleteMany({ userId: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);

    res.json({ deleted: true, id: user.id, name: user.name });
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

router.get("/users/:userId/progress", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select("name email avatar studentId className accountType isSuspended enrolledCourses progress").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    const enrollments = await Enrollment.find({ student: user._id }).lean();
    const progressRecords = await Progress.find({ student: user._id }).lean();
    const courseIds = [...new Set([...enrollments.map((entry) => String(entry.course)), ...(user.enrolledCourses || []), ...progressRecords.map((entry) => String(entry.course))])];
    const courses = await Course.find({ _id: { $in: courseIds } }).select("_id title lessons").lean();
    const progressByCourse = new Map(progressRecords.map((entry) => [String(entry.course), Number(entry.completedLessons || 0)]));
    const coursesProgress = courses.map((course) => {
      const completedLessons = progressByCourse.has(String(course._id)) ? progressByCourse.get(String(course._id)) : Number(user.progress?.[course._id] || 0);
      const lessonCount = Array.isArray(course.lessons) ? course.lessons.length : 0;
      return { courseId: course._id, title: course.title, completedLessons, lessonCount, percentage: lessonCount ? Math.round((completedLessons / lessonCount) * 100) : 0 };
    });
    res.json({ user, courses: coursesProgress });
  } catch (error) { next(error); }
});

router.post("/users/:userId/progress/reset", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const courseId = String(req.body.courseId || "").trim();
    if (courseId) {
      const course = await Course.findById(courseId).select("title").lean();
      if (!course) return res.status(404).json({ error: "Course not found" });
      await Progress.updateOne({ student: user._id, course: courseId }, { $set: { completedLessons: 0 } });
      if (user.progress instanceof Map) user.progress.delete(courseId);
      else if (user.progress && typeof user.progress === "object") delete user.progress[courseId];
      await user.save();
      await UserActivityLog.create({ user: user._id, action: "progress_reset", ipAddress: req.ip || "", userAgent: req.get("user-agent") || "", metadata: { courseId, courseTitle: course.title, scope: "course" }, actor: req.admin?.adminId || "administrator" });
    } else {
      await Progress.deleteMany({ student: user._id });
      user.progress = new Map();
      await user.save();
      await UserActivityLog.create({ user: user._id, action: "progress_reset", ipAddress: req.ip || "", userAgent: req.get("user-agent") || "", metadata: { scope: "all" }, actor: req.admin?.adminId || "administrator" });
    }
    res.json({ reset: true, courseId: courseId || null });
  } catch (error) { next(error); }
});

router.get("/users/:userId/activity", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select("name email avatar studentId className accountType isSuspended enrolledCourses progress updatedAt").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    const [enrollments, progressRecords, timeline] = await Promise.all([
      Enrollment.find({ student: user._id }).lean(),
      Progress.find({ student: user._id }).lean(),
      UserActivityLog.find({ user: user._id }).sort({ timestamp: -1 }).limit(500).lean(),
    ]);
    const courseIds = [...new Set([...enrollments.map((entry) => String(entry.course)), ...(user.enrolledCourses || []), ...progressRecords.map((entry) => String(entry.course))])];
    const courses = await Course.find({ _id: { $in: courseIds } }).select("_id title lessons").lean();
    const progressByCourse = new Map(progressRecords.map((entry) => [String(entry.course), Number(entry.completedLessons || 0)]));
    const coursesProgress = courses.map((course) => {
      const completedLessons = progressByCourse.has(String(course._id)) ? progressByCourse.get(String(course._id)) : Number(user.progress?.[course._id] || 0);
      const lessonCount = course.lessons?.length || 0;
      return { courseId: course._id, title: course.title, completedLessons, lessonCount, percentage: lessonCount ? Math.round((completedLessons / lessonCount) * 100) : 0 };
    });
    res.json({ profile: user, courses: coursesProgress, timeline });
  } catch (error) { next(error); }
});

router.post("/users/bulk-import", async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.users)) return res.status(400).json({ error: "users must be an array" });
    let createdCount = 0;
    let skippedCount = 0;
    const failedRows = [];
    for (let index = 0; index < req.body.users.length; index += 1) {
      const row = req.body.users[index] || {};
      const rowNumber = index + 2;
      const name = String(row.name || "").trim();
      const email = String(row.email || "").trim().toLowerCase();
      const accountType = String(row.accountType || "student").trim().toLowerCase();
      if (!name || name.length > 120) {
        failedRows.push({ row: rowNumber, email, reason: "Name is required or too long" });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        failedRows.push({ row: rowNumber, email, reason: "Invalid email address" });
        continue;
      }
      if (!["student", "instructor", "staff", "guest"].includes(accountType)) {
        failedRows.push({ row: rowNumber, email, reason: "Invalid accountType" });
        continue;
      }
      if (await User.exists({ email })) {
        skippedCount += 1;
        continue;
      }
      await User.create({
        name,
        email,
        studentId: String(row.studentId || "").trim().slice(0, 80),
        className: String(row.className || "").trim().slice(0, 120),
        accountType,
      });
      createdCount += 1;
    }
    await UserActivityLog.create({
      action: "bulk_import",
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
      metadata: { createdCount, skippedCount, failedCount: failedRows.length },
      actor: req.admin?.adminId || "administrator",
    });
    res.json({ createdCount, skippedCount, failedRows });
  } catch (error) { next(error); }
});

router.get("/announcements", async (_req, res, next) => {
  try { res.json(await Announcement.find().sort({ createdAt: -1 }).limit(50).lean()); }
  catch (error) { next(error); }
});

router.post("/announcements", async (req, res, next) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Announcement message is required" });
    if (message.length > 1000) return res.status(400).json({ error: "Announcement is too long" });
    await Announcement.updateMany({ isActive: true }, { $set: { isActive: false } });
    const announcement = await Announcement.create({ message, isActive: true, createdBy: req.admin?.adminId || "administrator" });
    res.status(201).json(announcement);
  } catch (error) { next(error); }
});

router.patch("/announcements/:id/deactivate", async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });
    res.json(announcement);
  } catch (error) { next(error); }
});

router.delete("/announcements/:id", async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });
    res.json({ deleted: true, id: announcement.id });
  } catch (error) { next(error); }
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

router.delete("/queries/:id", async (req, res, next) => {
  try {
    const query = await Query.findByIdAndDelete(req.params.id);
    if (!query) return res.status(404).json({ message: "Query not found" });
    await UserActivityLog.create({
      user: query.userId || null,
      action: "query_delete",
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
      metadata: { queryId: query.id },
      actor: req.admin?.adminId || "administrator",
    });
    res.json({ deleted: true, id: query.id });
  } catch (error) { next(error); }
});

router.post("/queries/bulk-delete", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ message: "ids must contain at least one query ID" });
    const result = await Query.deleteMany({ _id: { $in: ids } });
    await UserActivityLog.create({
      action: "query_delete",
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
      metadata: { deletedCount: result.deletedCount, queryIds: ids },
      actor: req.admin?.adminId || "administrator",
    });
    res.json({ deletedCount: result.deletedCount });
  } catch (error) { next(error); }
});

export default router;
