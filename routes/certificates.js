import { Router } from "express";
import crypto from "node:crypto";
import auth from "../middleware/auth.js";
import Certificate from "../models/Certificate.js";
import Course from "../models/Course.js";
import Progress from "../models/Progress.js";
import XpTransaction from "../models/XpTransaction.js";
import CertificateRequest from "../models/CertificateRequest.js";

const router = Router();
const derivedStudentId = (email) => String(email || "").split("@")[0].replace(/[^a-z0-9-]/gi, "").slice(0, 80);
const courseXpThreshold = (course) => /html|css/.test(String(course.title || "").toLowerCase()) ? 100 : 150;

async function studentXp(req) {
  const [records, manualTransactions] = await Promise.all([
    Progress.find({ student: req.user._id }).lean(),
    XpTransaction.find({ student: req.user._id, type: "quiz" }).lean(),
  ]);
  const progressMap = req.user.progress ? Object.fromEntries(req.user.progress) : {};
  let lessonCount = 0;
  for (const record of records) lessonCount += Number(record.completedLessons || 0);
  for (const [courseId, count] of Object.entries(progressMap)) {
    if (!records.some((record) => String(record.course) === String(courseId))) lessonCount += Number(count || 0);
  }
  const manualXp = manualTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return lessonCount * 50 + manualXp;
}

router.get("/", auth, async (req, res, next) => {
  try {
    const [courses, certificates, requests, records, xp] = await Promise.all([
      Course.find().select("_id title lessons").lean(),
      Certificate.find({ student: req.user._id }).lean(),
      CertificateRequest.find({ student: req.user._id }).sort({ createdAt: -1 }).lean(),
      Progress.find({ student: req.user._id }).lean(),
      studentXp(req),
    ]);
    const progressMap = req.user.progress ? Object.fromEntries(req.user.progress) : {};
    const recordMap = new Map(records.map((record) => [String(record.course), Number(record.completedLessons || 0)]));
    const certificateMap = new Map(certificates.map((item) => [item.course, item]));
    const requestMap = new Map(requests.map((item) => [item.course, item]));
    const items = courses.map((course) => {
      const completedLessons = recordMap.get(String(course._id)) ?? Number(progressMap[course._id] || 0);
      const lessonCount = Array.isArray(course.lessons) ? course.lessons.length : 0;
      const completed = lessonCount > 0 && completedLessons >= lessonCount;
      const requiredXp = courseXpThreshold(course);
      return {
        courseId: course._id,
        courseTitle: course.title,
        completed,
        completedLessons,
        lessonCount,
        requiredXp,
        currentXp: xp,
        eligible: completed && xp >= requiredXp,
        certificate: certificateMap.get(course._id) || null,
        request: requestMap.get(course._id) || null,
      };
    });
    res.json({ xp, certificates, courses: items });
  } catch (error) { next(error); }
});

router.get("/quiz/:courseId", auth, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId).select("title lessons").lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    const available = [];
    (course.lessons || []).forEach((lesson, lessonIndex) => {
      (lesson?.questions || []).forEach((question, questionIndex) => {
        if (Array.isArray(question) && question.length >= 3) {
          available.push({ lessonIndex, questionIndex, question: question[0], options: question[1] });
        } else if (question?.question && Array.isArray(question?.options)) {
          available.push({ lessonIndex, questionIndex, question: question.question, options: question.options });
        }
      });
    });
    if (!available.length) return res.status(404).json({ error: "No quiz questions are available for this course" });
    const quiz = available[Math.floor(Math.random() * available.length)];
    res.json({ ...quiz, courseId: course._id, rewardXp: 25 });
  } catch (error) { next(error); }
});

router.post("/quiz/complete", auth, async (req, res, next) => {
  try {
    const { courseId, lessonIndex, questionIndex, selectedIndex, transactionId } = req.body;
    if (!courseId || !Number.isInteger(lessonIndex) || !Number.isInteger(questionIndex) || !Number.isInteger(selectedIndex)) {
      return res.status(400).json({ error: "A course, lesson, question, and answer are required" });
    }
    const course = await Course.findById(courseId).select("title lessons").lean();
    const rawQuestion = course?.lessons?.[lessonIndex]?.questions?.[questionIndex];
    const question = Array.isArray(rawQuestion)
      ? { options: rawQuestion[1], correctIndex: rawQuestion[2] }
      : rawQuestion && { options: rawQuestion.options, correctIndex: rawQuestion.correctIndex };
    if (!course || !question || !Array.isArray(question.options) || !Number.isInteger(question.correctIndex)) {
      return res.status(404).json({ error: "Quiz question not found" });
    }
    if (selectedIndex < 0 || selectedIndex >= question.options.length) return res.status(400).json({ error: "Invalid answer" });
    if (selectedIndex !== question.correctIndex) return res.status(400).json({ error: "Incorrect answer. Review the course and try again.", passed: false });
    const id = String(transactionId || "").trim() || crypto.randomUUID();
    const existing = await XpTransaction.findOne({ transactionId: id }).lean();
    if (existing) return res.json({ passed: true, awardedXp: 0, totalXp: await studentXp(req), duplicate: true });
    await XpTransaction.create({ student: req.user._id, transactionId: id, type: "quiz", amount: 25, course: courseId });
    req.user.xpBalance = Number(req.user.xpBalance || 0) + 25;
    await req.user.save();
    res.json({ passed: true, awardedXp: 25, totalXp: await studentXp(req), duplicate: false });
  } catch (error) { next(error); }
});

router.post("/request/:courseId", auth, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId).select("_id title lessons").lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    const record = await Progress.findOne({ student: req.user._id, course: course._id }).lean();
    const completedLessons = record?.completedLessons ?? Number(req.user.progress?.get(req.params.courseId) || 0);
    if (!course.lessons.length || completedLessons < course.lessons.length) return res.status(400).json({ error: "Complete every lesson before claiming this certificate" });
    const xp = await studentXp(req);
    const requiredXp = courseXpThreshold(course);
    if (xp < requiredXp) return res.status(400).json({ error: `This certificate requires ${requiredXp} XP`, currentXp: xp, requiredXp });
    const existingRequest = await CertificateRequest.findOne({ student: req.user._id, course: course._id, status: { $in: ["pending", "approved"] } });
    if (existingRequest) return res.status(200).json(existingRequest);
    const request = await CertificateRequest.create({
      student: req.user._id,
      studentName: req.user.name,
      immutableStudentId: req.user.studentId || derivedStudentId(req.user.email),
      course: course._id,
      courseTitle: course.title,
      requiredXp,
      currentXp: xp,
      status: "pending",
    });
    res.status(201).json(request);
  } catch (error) { next(error); }
});

router.get("/verify/:certificateId", async (req, res, next) => {
  try {
    const certificate = await Certificate.findOne({ verificationId: req.params.certificateId }).lean();
    if (!certificate) return res.status(404).json({ error: "Certificate not found" });
    res.json({ verified: true, certificate });
  } catch (error) { next(error); }
});

export default router;
