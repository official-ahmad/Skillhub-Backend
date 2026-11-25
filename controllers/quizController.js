import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";
import QuizAttempt from "../models/QuizAttempt.js";
import User from "../models/User.js";
import XpTransaction from "../models/XpTransaction.js";

const PASS_MARK = 75;
const LESSON_QUESTION_COUNT = 5;
const MARATHON_QUESTION_COUNT = 20;
const MARATHON_DURATION_MS = 20 * 60 * 1000;

const getLessonQuestions = (lesson) =>
  Array.isArray(lesson) ? lesson[2] : lesson?.questions;

function normalizeQuestion(rawQuestion, courseId, lessonIndex, questionIndex) {
  const question = Array.isArray(rawQuestion) ? rawQuestion[0] : rawQuestion?.question;
  const options = Array.isArray(rawQuestion) ? rawQuestion[1] : rawQuestion?.options;
  const correctIndex = Array.isArray(rawQuestion) ? rawQuestion[2] : rawQuestion?.correctIndex;
  if (
    typeof question !== "string" ||
    !Array.isArray(options) ||
    options.length < 2 ||
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) return null;
  const sourceId = Array.isArray(rawQuestion) ? "" : rawQuestion?.questionId || rawQuestion?.id;
  return {
    questionId: sourceId
      ? `${courseId}:lesson:${lessonIndex}:${String(sourceId)}`
      : `${courseId}:lesson:${lessonIndex}:question:${questionIndex}`,
    question,
    options: options.map(String),
    correctIndex,
  };
}

const publicAttempt = (attempt) => ({
  attemptId: String(attempt._id),
  status: attempt.status,
  kind: attempt.kind,
  expiresAt: attempt.expiresAt,
  result: attempt.result,
  questions: attempt.questions.map(({ questionId, question, options }) => ({ questionId, question, options })),
});

async function completedLessonCount(courseId, student, user) {
  const record = await Progress.findOne({ student, course: courseId }).select("completedLessons").lean();
  return Number(record?.completedLessons ?? user.progress?.get(courseId) ?? 0);
}

async function startAttempt({ req, res, course, kind, lessonIndex = -1, attemptId }) {
  if (attemptId) {
    const existing = await QuizAttempt.findOne({ _id: attemptId, student: req.user._id, course: course._id, kind, lessonIndex });
    if (existing) {
      if (existing.status === "active" && existing.expiresAt && existing.expiresAt <= new Date()) {
        existing.status = "expired";
        await existing.save();
      }
      return res.json(publicAttempt(existing));
    }
  }

  const completedLessons = await completedLessonCount(course._id, req.user._id, req.user);
  if (kind === "lesson" && lessonIndex > completedLessons)
    return res.status(409).json({ error: "Complete lessons in order", completedLessons });
  if (kind === "marathon" && (!course.lessons.length || completedLessons < course.lessons.length))
    return res.status(409).json({ error: "Complete every lesson before starting the Marathon Quiz", completedLessons, lessonCount: course.lessons.length });

  let pool = [];
  if (kind === "lesson") {
    const rawQuestions = getLessonQuestions(course.lessons[lessonIndex]);
    if (!Array.isArray(rawQuestions) || !rawQuestions.length)
      return res.status(404).json({ error: "Lesson quiz not found" });
    pool = rawQuestions.map((question, questionIndex) => normalizeQuestion(question, course._id, lessonIndex, questionIndex)).filter(Boolean);
  } else {
    pool = course.lessons.flatMap((lesson, index) => {
      const questions = getLessonQuestions(lesson);
      return Array.isArray(questions)
        ? questions.map((question, questionIndex) => normalizeQuestion(question, course._id, index, questionIndex)).filter(Boolean)
        : [];
    });
  }
  const uniquePool = [...new Map(pool.map((question) => [question.questionId, question])).values()];
  const questionCount = kind === "marathon" ? MARATHON_QUESTION_COUNT : Math.min(LESSON_QUESTION_COUNT, uniquePool.length);
  if (kind === "marathon" && uniquePool.length < MARATHON_QUESTION_COUNT)
    return res.status(422).json({ error: `This course needs at least ${MARATHON_QUESTION_COUNT} valid questions for its Marathon Quiz`, availableQuestions: uniquePool.length });
  if (!questionCount) return res.status(404).json({ error: "No valid quiz questions are available" });

  const activeFilter = { student: req.user._id, course: course._id, kind, lessonIndex, status: "active" };
  await QuizAttempt.updateMany(activeFilter, { $set: { status: "superseded" } });

  const previousAttempts = await QuizAttempt.find({ student: req.user._id, course: course._id, kind, lessonIndex }).select("questionIds").lean();
  const seen = new Set(previousAttempts.flatMap((attempt) => attempt.questionIds || []));
  let freshQuestions = uniquePool.filter((question) => !seen.has(question.questionId));
  if (!freshQuestions.length) freshQuestions = uniquePool;
  const selected = [];
  const shuffledFresh = freshQuestions.sort(() => Math.random() - 0.5);
  selected.push(...shuffledFresh.slice(0, questionCount));
  if (selected.length < questionCount) {
    const selectedIds = new Set(selected.map((question) => question.questionId));
    const topUp = uniquePool.filter((question) => !selectedIds.has(question.questionId)).sort(() => Math.random() - 0.5);
    selected.push(...topUp.slice(0, questionCount - selected.length));
  }
  selected.sort(() => Math.random() - 0.5);

  const attempt = await QuizAttempt.create({
    student: req.user._id,
    course: course._id,
    kind,
    lessonIndex,
    questionIds: selected.map(({ questionId }) => questionId),
    questions: selected,
    expiresAt: kind === "marathon" ? new Date(Date.now() + MARATHON_DURATION_MS) : null,
  });
  res.status(201).json(publicAttempt(attempt));
}

export async function startLessonQuiz(req, res, next) {
  try {
    const lessonIndex = Number(req.params.lessonIndex);
    if (!Number.isInteger(lessonIndex) || lessonIndex < 0)
      return res.status(400).json({ error: "A valid lesson index is required" });
    const course = await Course.findById(req.params.courseId).select("title lessons").lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    return await startAttempt({ req, res, course, kind: "lesson", lessonIndex, attemptId: req.body?.attemptId });
  } catch (error) { next(error); }
}

export async function startMarathonQuiz(req, res, next) {
  try {
    const course = await Course.findById(req.params.courseId).select("title lessons").lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    return await startAttempt({ req, res, course, kind: "marathon", attemptId: req.body?.attemptId });
  } catch (error) { next(error); }
}

export async function marathonStatus(req, res, next) {
  try {
    const course = await Course.findById(req.params.courseId).select("lessons").lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    const [completedLessons, passedAttempt] = await Promise.all([
      completedLessonCount(course._id, req.user._id, req.user),
      QuizAttempt.findOne({ student: req.user._id, course: course._id, kind: "marathon", status: "graded", "result.passed": true }).select("result createdAt").sort({ createdAt: -1 }).lean(),
    ]);
    res.json({
      unlocked: course.lessons.length > 0 && completedLessons >= course.lessons.length,
      passed: Boolean(passedAttempt),
      result: passedAttempt?.result || null,
    });
  } catch (error) { next(error); }
}

async function submitAttempt(req, res, next, kind) {
  try {
    const attemptId = String(req.body?.attemptId || "");
    const submittedAnswers = req.body?.submittedAnswers;
    if (!attemptId || !Array.isArray(submittedAnswers))
      return res.status(400).json({ error: "A quiz attempt and answer list are required" });
    const attempt = await QuizAttempt.findOne({ _id: attemptId, student: req.user._id, course: req.params.courseId, kind });
    if (!attempt) return res.status(404).json({ error: "Quiz attempt not found" });
    if (attempt.status === "graded" || attempt.status === "expired") return res.json(attempt.result);
    if (attempt.status !== "active") return res.status(409).json({ error: "This quiz attempt is no longer active" });
    if (kind === "lesson" && Number(req.params.lessonIndex) !== attempt.lessonIndex)
      return res.status(400).json({ error: "Attempt does not match this lesson" });

    const submitted = new Map();
    for (const answer of submittedAnswers) {
      if (typeof answer?.questionId !== "string" || submitted.has(answer.questionId))
        return res.status(400).json({ error: "Invalid quiz answers" });
      if (answer.selectedIndex !== null && (!Number.isInteger(answer.selectedIndex) || answer.selectedIndex < 0))
        return res.status(400).json({ error: "Invalid answer option" });
      submitted.set(answer.questionId, answer.selectedIndex);
    }
    if (submitted.size !== attempt.questions.length || attempt.questions.some(({ questionId }) => !submitted.has(questionId)))
      return res.status(400).json({ error: "Submit an answer for every question" });
    if (attempt.questions.some(({ questionId, options }) => {
      const index = submitted.get(questionId);
      return index !== null && index >= options.length;
    })) return res.status(400).json({ error: "Invalid answer option" });

    let correct = 0;
    const questionResults = attempt.questions.map((question) => {
      const selectedIndex = submitted.get(question.questionId);
      const selectedOption = selectedIndex === null ? "Unanswered" : question.options[selectedIndex];
      const isCorrect = selectedIndex === question.correctIndex;
      if (isCorrect) correct += 1;
      return {
        questionId: question.questionId,
        question: question.question,
        selectedOption,
        correctOption: question.options[question.correctIndex],
        isCorrect,
      };
    });
    const scorePercent = Math.round((correct / attempt.questions.length) * 100);
    const isTimedOut = kind === "marathon" && attempt.expiresAt <= new Date();
    const passed = !isTimedOut && scorePercent >= PASS_MARK;

    let xpEarned = 0;
    let completedLessons = await completedLessonCount(attempt.course, req.user._id, req.user);
    if (kind === "lesson" && passed && attempt.lessonIndex > completedLessons)
      return res.status(409).json({ error: "Complete lessons in order", completedLessons });
    if (kind === "lesson" && passed && attempt.lessonIndex === completedLessons) {
      const nextCount = attempt.lessonIndex + 1;
      try {
        await Progress.updateOne({ student: req.user._id, course: attempt.course }, { $max: { completedLessons: nextCount }, $setOnInsert: { student: req.user._id, course: attempt.course } }, { upsert: true, runValidators: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        await Progress.updateOne({ student: req.user._id, course: attempt.course }, { $max: { completedLessons: nextCount } }, { runValidators: true });
      }
      await User.updateOne({ _id: req.user._id }, { $max: { [`progress.${attempt.course}`]: nextCount }, $addToSet: { enrolledCourses: attempt.course } });
      await Enrollment.findOneAndUpdate({ student: req.user._id, course: attempt.course }, { $setOnInsert: { student: req.user._id, course: attempt.course } }, { upsert: true });
      completedLessons = Math.max(nextCount, completedLessons);
      const transactionId = `lesson:${req.user._id}:${attempt.course}:${attempt.lessonIndex}`;
      try {
        await XpTransaction.create({ student: req.user._id, transactionId, type: "lesson", amount: 50, course: attempt.course });
        xpEarned = 50;
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    if (kind === "marathon" && passed) {
      const transactionId = `marathon:${req.user._id}:${attempt.course}`;
      try {
        await XpTransaction.create({ student: req.user._id, transactionId, type: "quiz", amount: 50, course: attempt.course });
        await User.updateOne({ _id: req.user._id }, { $inc: { xpBalance: 50 } });
        xpEarned = 50;
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    const result = {
      score: correct,
      totalQuestions: attempt.questions.length,
      scorePercent,
      passed,
      xpEarned,
      questionResults,
      completedLessons,
      timedOut: Boolean(isTimedOut),
      passMark: PASS_MARK,
    };
    const updatedAttempt = await QuizAttempt.findOneAndUpdate(
      { _id: attempt._id, status: "active" },
      { $set: { status: isTimedOut ? "expired" : "graded", result } },
      { new: true },
    );
    if (!updatedAttempt) {
      const latest = await QuizAttempt.findById(attempt._id).lean();
      return res.json(latest?.result || result);
    }
    res.json(result);
  } catch (error) { next(error); }
}

export const submitLessonQuizAttempt = (req, res, next) => submitAttempt(req, res, next, "lesson");
export const submitMarathonQuizAttempt = (req, res, next) => submitAttempt(req, res, next, "marathon");
