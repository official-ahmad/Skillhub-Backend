import Course from "../models/Course.js";
import { getCached, setCached } from "../utils/shortCache.js";

const COURSE_LIST_CACHE_KEY = "public:courses:list";

function stripQuestionAnswers(question) {
  if (Array.isArray(question)) return question.slice(0, 2);
  if (!question || typeof question !== "object") return question;
  const safeQuestion = { ...question };
  delete safeQuestion.correctIndex;
  return safeQuestion;
}

function stripLessonAnswers(lesson) {
  if (Array.isArray(lesson)) {
    const safeLesson = [...lesson];
    if (Array.isArray(safeLesson[2]))
      safeLesson[2] = safeLesson[2].map(stripQuestionAnswers);
    return safeLesson;
  }
  if (!lesson || typeof lesson !== "object") return lesson;
  const safeLesson = { ...lesson };
  if (Array.isArray(safeLesson.questions))
    safeLesson.questions = safeLesson.questions.map(stripQuestionAnswers);
  return safeLesson;
}

function stripCourseAnswers(course) {
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  return {
    ...course,
    lessonCount: lessons.length,
    totalLessons: lessons.length,
    lessons: lessons.map(stripLessonAnswers),
  };
}

export async function listCourses(_req, res, next) {
  try {
    const cached = getCached(COURSE_LIST_CACHE_KEY);
    if (cached) return res.json(cached);

    const courses = await Course.find()
      .select("_id title category description level instructor instructorPhoto instructorUrl instructorUrlVerified instructorChannelUrl instructorVerified image uploadType videoOrPlaylistUrl tags icon colorIndex duration createdAt updatedAt")
      .sort({ colorIndex: 1 })
      .lean();
    const counts = await Course.aggregate([
      { $project: { _id: 1, lessonCount: { $cond: [{ $isArray: "$lessons" }, { $size: "$lessons" }, 0] } } },
    ]);
    const countsById = new Map(counts.map((item) => [String(item._id), item.lessonCount]));
    const response = courses.map((course) => ({
      ...course,
      lessonCount: countsById.get(String(course._id)) || 0,
      totalLessons: countsById.get(String(course._id)) || 0,
      lessons: [],
      duration: course.duration || 0,
      tags: course.tags || [],
    }));
    res.json(setCached(COURSE_LIST_CACHE_KEY, response, 20_000));
  } catch (error) { next(error); }
}
export async function getCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.courseId).lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(stripCourseAnswers(course));
  } catch (error) { next(error); }
}
