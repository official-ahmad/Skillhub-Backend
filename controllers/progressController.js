import User from "../models/User.js";
import Course from "../models/Course.js";
import Progress from "../models/Progress.js";
import Enrollment from "../models/Enrollment.js";
import UserActivityLog from "../models/UserActivityLog.js";
import XpTransaction from "../models/XpTransaction.js";

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
    const progressRecord = await Progress.findOne({ student: req.user._id, course: courseId }).lean();
    const currentCount = progressRecord?.completedLessons ?? Number(req.user.progress?.get(courseId) || 0);
    if (count > currentCount + 1)
      return res.status(400).json({ error: "Complete lessons in order" });
    if (count > currentCount) {
      const lesson = course.lessons[currentCount];
      const questions = Array.isArray(lesson) ? lesson[2] : lesson?.questions;
      if (Array.isArray(questions) && questions.length)
        return res.status(400).json({ error: "Pass the lesson quiz to record completion" });
      await Progress.updateOne(
        { student: req.user._id, course: courseId },
        { $max: { completedLessons: count }, $setOnInsert: { student: req.user._id, course: courseId } },
        { upsert: true, runValidators: true },
      );
      await User.updateOne(
        { _id: req.user._id },
        { $max: { [`progress.${courseId}`]: count }, $addToSet: { enrolledCourses: courseId } },
      );
      await Enrollment.findOneAndUpdate(
        { student: req.user._id, course: courseId },
        { $setOnInsert: { student: req.user._id, course: courseId } },
        { upsert: true },
      );
      await UserActivityLog.create({ user: req.user._id, action: "course_enrollment", ipAddress: req.ip || "", userAgent: req.get("user-agent") || "", metadata: { courseId, courseTitle: course.title }, actor: req.user.name });
    }
    const progress = { ...objectMap(req.user.progress), [courseId]: currentCount === count ? count : Math.max(currentCount, count) };
    res.json({ progress, totalPassed: Object.values(progress).reduce((sum, value) => sum + Number(value || 0), 0) });
  } catch (error) { next(error); }
}

export async function submitLessonQuiz(req, res, next) {
  try {
    const { courseId } = req.params;
    const lessonIndex = Number(req.params.lessonIndex);
    const submittedAnswers = req.body.submittedAnswers;
    if (!Number.isInteger(lessonIndex) || lessonIndex < 0 || !Array.isArray(submittedAnswers))
      return res.status(400).json({ error: "A valid lesson and answer list are required" });

    const course = await Course.findById(courseId).select("title lessons").lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    const lesson = course.lessons?.[lessonIndex];
    const questions = Array.isArray(lesson)
      ? lesson[2]
      : lesson?.questions;
    if (!Array.isArray(questions) || !questions.length)
      return res.status(404).json({ error: "Lesson quiz not found" });

    const submitted = new Map();
    for (const answer of submittedAnswers) {
      if (!Number.isInteger(answer?.questionIndex) || !Number.isInteger(answer?.selectedIndex) || submitted.has(answer.questionIndex))
        return res.status(400).json({ error: "Invalid quiz answers" });
      submitted.set(answer.questionIndex, answer.selectedIndex);
    }
    if (submitted.size !== questions.length || questions.some((_, index) => !submitted.has(index)))
      return res.status(400).json({ error: "Submit one answer for every question" });

    let correct = 0;
    const questionResults = [];
    for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
      const rawQuestion = questions[questionIndex];
      const options = Array.isArray(rawQuestion) ? rawQuestion[1] : rawQuestion?.options;
      const correctIndex = Array.isArray(rawQuestion) ? rawQuestion[2] : rawQuestion?.correctIndex;
      const selectedIndex = submitted.get(questionIndex);
      if (!Array.isArray(options) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length)
        return res.status(500).json({ error: "Quiz data is invalid" });
      if (selectedIndex < 0 || selectedIndex >= options.length)
        return res.status(400).json({ error: "Invalid answer option" });
      const isCorrect = selectedIndex === correctIndex;
      if (isCorrect) correct += 1;
      questionResults.push({
        question: Array.isArray(rawQuestion) ? rawQuestion[0] : rawQuestion?.question,
        selectedOption: options[selectedIndex],
        correctOption: options[correctIndex],
        isCorrect,
      });
    }

    const scorePercent = Math.round((correct / questions.length) * 100);
    const passed = scorePercent >= 60;
    const progressRecord = await Progress.findOne({ student: req.user._id, course: courseId }).lean();
    const existingCount = progressRecord?.completedLessons ?? Number(req.user.progress?.get(courseId) || 0);
    if (passed && lessonIndex > existingCount)
      return res.status(409).json({ error: "Complete lessons in order", completedLessons: existingCount });

    let completedLessons = existingCount;
    let xpEarned = 0;
    if (passed && lessonIndex === existingCount) {
      completedLessons = lessonIndex + 1;
      try {
        await Progress.updateOne(
          { student: req.user._id, course: courseId },
          { $max: { completedLessons }, $setOnInsert: { student: req.user._id, course: courseId } },
          { upsert: true, runValidators: true },
        );
      } catch (error) {
        // Concurrent first submissions can race on the unique student/course index.
        if (error.code !== 11000) throw error;
        await Progress.updateOne(
          { student: req.user._id, course: courseId },
          { $max: { completedLessons } },
          { runValidators: true },
        );
      }
      await User.updateOne(
        { _id: req.user._id },
        { $max: { [`progress.${courseId}`]: completedLessons }, $addToSet: { enrolledCourses: courseId } },
      );
      completedLessons = Math.max(completedLessons, Number(req.user.progress?.get(courseId) || 0));
      try {
        await XpTransaction.create({
          student: req.user._id,
          transactionId: `lesson:${req.user._id}:${courseId}:${lessonIndex}`,
          type: "lesson",
          amount: 50,
          course: courseId,
        });
        xpEarned = 50;
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    const totalProgress = await Progress.find({ student: req.user._id }).select("course completedLessons").lean();
    const progressMap = new Map(totalProgress.map((record) => [String(record.course), Number(record.completedLessons || 0)]));
    for (const [id, count] of req.user.progress || []) {
      if (!progressMap.has(String(id))) progressMap.set(String(id), Number(count || 0));
    }
    const totalXp = [...progressMap.values()].reduce((sum, count) => sum + count * 50, 0);
    res.json({
      score: correct,
      totalQuestions: questions.length,
      scorePercent,
      passed,
      xpEarned,
      questionResults,
      completedLessons,
      totalXp,
    });
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
