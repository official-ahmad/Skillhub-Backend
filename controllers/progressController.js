import User from "../models/User.js";
import Course from "../models/Course.js";

const objectMap = (map) => Object.fromEntries(map || []);

export function getProgress(req, res) {
  res.json({ progress: objectMap(req.user.progress), notes: objectMap(req.user.notes), bookmarks: req.user.bookmarks });
}

export async function updateProgress(req, res, next) {
  try {
    const { courseId } = req.params;
    const count = Number(req.body.completedLessons);
    if (!Number.isInteger(count) || count < 0) return res.status(400).json({ error: "completedLessons must be a non-negative integer" });
    const course = await Course.findById(courseId).select("lessons");
    if (!course) return res.status(404).json({ error: "Course not found" });
    if (count > course.lessons.length) return res.status(400).json({ error: "Progress exceeds course lesson count" });
    req.user.progress.set(courseId, count);
    if (count > 0 && !req.user.enrolledCourses.includes(courseId)) req.user.enrolledCourses.push(courseId);
    await req.user.save();
    res.json({ progress: objectMap(req.user.progress), totalPassed: [...req.user.progress.values()].reduce((a, b) => a + b, 0) });
  } catch (error) { next(error); }
}

export async function updateNote(req, res, next) {
  try {
    const { courseId, lessonIndex } = req.params;
    const index = Number(lessonIndex);
    const course = await Course.findById(courseId).select("lessons");
    if (!course || !Number.isInteger(index) || index < 0 || index >= course.lessons.length) return res.status(404).json({ error: "Lesson not found" });
    const key = `${courseId}_${index}`;
    req.user.notes.set(key, String(req.body.text || "").slice(0, 5000));
    await req.user.save();
    res.json({ notes: objectMap(req.user.notes) });
  } catch (error) { next(error); }
}

export async function resetProgress(req, res, next) {
  try { req.user.progress = new Map(); await req.user.save(); res.json({ progress: {} }); } catch (error) { next(error); }
}

export async function importLegacyProgress(req, res, next) {
  try {
    if (req.user.legacyMigratedAt) return res.status(409).json({ error: "Legacy data has already been imported" });
    const progress = req.body.progress && typeof req.body.progress === "object" ? req.body.progress : {};
    const notes = req.body.notes && typeof req.body.notes === "object" ? req.body.notes : {};
    const courses = await Course.find({ _id: { $in: Object.keys(progress) } }).select("_id lessons");
    const courseLengths = new Map(courses.map((course) => [course.id, course.lessons.length]));
    for (const [courseId, rawCount] of Object.entries(progress)) {
      const count = Number(rawCount);
      if (!courseLengths.has(courseId) || !Number.isInteger(count) || count < 0 || count > courseLengths.get(courseId)) {
        return res.status(400).json({ error: `Invalid legacy progress for course ${courseId}` });
      }
      if (count > 0) {
        req.user.progress.set(courseId, Math.max(req.user.progress.get(courseId) || 0, count));
        if (!req.user.enrolledCourses.includes(courseId)) req.user.enrolledCourses.push(courseId);
      }
    }
    for (const [key, value] of Object.entries(notes)) {
      if (typeof value === "string" && /^[\w-]+_\d+$/.test(key)) req.user.notes.set(key, value.slice(0, 5000));
    }
    req.user.legacyMigratedAt = new Date();
    await req.user.save();
    res.json({ imported: true, progress: objectMap(req.user.progress), notes: objectMap(req.user.notes) });
  } catch (error) { next(error); }
}

export async function leaderboard(_req, res, next) {
  try {
    const users = await User.find().select("name studentId className progress").lean();
    const standings = users.map((user) => {
      const progress = Object.values(user.progress || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      return { id: user._id.toString(), name: user.name, studentId: user.studentId, className: user.className, passedCount: progress, xp: progress * 50 };
    }).sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
    res.json(standings);
  } catch (error) { next(error); }
}
