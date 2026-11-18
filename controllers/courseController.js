import Course from "../models/Course.js";

export async function listCourses(_req, res, next) {
  try {
    const courses = await Course.find().sort({ colorIndex: 1 }).lean();
    res.json(courses.map((course) => ({ ...course, lessonCount: course.lessons.length, duration: course.duration || course.lessons.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0), tags: course.tags || [] })));
  } catch (error) { next(error); }
}
export async function getCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.courseId).lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) { next(error); }
}
