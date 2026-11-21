import User from "../models/User.js";
import Course from "../models/Course.js";
import Progress from "../models/Progress.js";
import Enrollment from "../models/Enrollment.js";
import UserActivityLog from "../models/UserActivityLog.js";

const objectMap = (map) => Object.fromEntries(map || []);

export async function getProgress(req, res, next) {
  try {
    const [records, enrollments] = await Promise.all([
      Progress.find({ student: req.user._id }).lean(),
      Enrollment.find({ student: req.user._id }).select("course").lean(),
    ]);
    const progress = objectMap(req.user.progress);
    for (const record of records) progress[record.course] = record.completedLessons;
    res.json({ progress, notes: objectMap(req.user.notes), bookmarks: req.user.bookmarks, enrolledCourses: enrollments.map(({ course }) => course) });
  } catch (error) { next(error); }
}

export async function updateProgress(req, res, next) {
  try {
    const { courseId } = req.params;
    const count = Number(req.body.completedLessons);
    if (!Number.isInteger(count) || count < 0) return res.status(400).json({ error: "completedLessons must be a non-negative integer" });
    const course = await Course.findById(courseId).select("title lessons");
    if (!course) return res.status(404).json({ error: "Course not found" });
    if (count > course.lessons.length) return res.status(400).json({ error: "Progress exceeds course lesson count" });
    req.user.progress.set(courseId, count);
    if (count > 0 && !req.user.enrolledCourses.includes(courseId)) req.user.enrolledCourses.push(courseId);
    await Progress.findOneAndUpdate({ student: req.user._id, course: courseId }, { $set: { completedLessons: count }, $setOnInsert: { student: req.user._id, course: courseId } }, { upsert: true, new: true, runValidators: true });
    if (count > 0) await Enrollment.findOneAndUpdate({ student: req.user._id, course: courseId }, { $setOnInsert: { student: req.user._id, course: courseId } }, { upsert: true });
    await req.user.save();
    if (count > 0) await UserActivityLog.create({ user: req.user._id, action: "course_enrollment", ipAddress: req.ip || "", userAgent: req.get("user-agent") || "", metadata: { courseId, courseTitle: course.title }, actor: req.user.name });
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
  try { req.user.progress = new Map(); await Promise.all([req.user.save(), Progress.deleteMany({ student: req.user._id })]); res.json({ progress: {} }); } catch (error) { next(error); }
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
    const progressWrites = Object.entries(progress).map(([courseId, rawCount]) => {
      const count = Number(rawCount);
      return Progress.updateOne({ student: req.user._id, course: courseId }, { $set: { completedLessons: Math.max(req.user.progress.get(courseId) || 0, count) }, $setOnInsert: { student: req.user._id, course: courseId } }, { upsert: true });
    });
    await Promise.all(progressWrites);
    const enrollmentWrites = Object.entries(progress).filter(([, rawCount]) => Number(rawCount) > 0).map(([course]) => ({ updateOne: { filter: { student: req.user._id, course }, update: { $setOnInsert: { student: req.user._id, course } }, upsert: true } }));
    if (enrollmentWrites.length) await Enrollment.bulkWrite(enrollmentWrites);
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
    const [users, records, courses] = await Promise.all([
      User.find({ cohort: "au-bsse-evening-2026" }).select("name studentId className avatar progress enrolledCourses").lean(),
      Progress.find().lean(),
      Course.find().select("_id lessons").lean(),
    ]);
    const counts = new Map();
    for (const user of users) {
      const legacy = Object.values(user.progress || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      counts.set(user._id.toString(), { passedCount: legacy, completedCourses: 0, enrolledCourses: (user.enrolledCourses || []).length });
    }
    const courseCounts = new Map();
    for (const record of records) {
      const id = record.student.toString();
      if (!counts.has(id)) continue;
      const score = counts.get(id);
      const course = courses.find((item) => item._id === record.course);
      const user = users.find((item) => item._id.toString() === id);
      score.passedCount += Number(record.completedLessons || 0) - Number(user.progress?.[record.course] || 0);
      if (course && record.completedLessons >= course.lessons.length) courseCounts.set(`${id}:${record.course}`, true);
      counts.set(id, score);
    }
    for (const user of users) counts.get(user._id.toString()).completedCourses = new Set([
      ...Object.entries(user.progress || {}).filter(([courseId, completed]) => {
        const course = courses.find((item) => item._id === courseId);
        return course && Number(completed) >= course.lessons.length;
      }).map(([courseId]) => `${user._id}:${courseId}`),
      ...[...courseCounts.keys()].filter((key) => key.startsWith(`${user._id}:`)),
    ]).size;
    const standings = users.map((user) => {
      const score = counts.get(user._id.toString());
      return { id: user._id.toString(), name: user.name, studentId: user.studentId, className: user.className, avatar: user.avatar, passedCount: score.passedCount, completedCourses: score.completedCourses, enrolledCourses: score.enrolledCourses, xp: score.passedCount * 50 };
    }).sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
    res.json(standings.map((student, index) => ({ ...student, rank: index + 1 })));
  } catch (error) { next(error); }
}
