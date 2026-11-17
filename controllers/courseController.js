import Course from "../models/Course.js";

export async function listCourses(_req, res, next) {
  try { res.json(await Course.find().lean()); } catch (error) { next(error); }
}
export async function getCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.courseId).lean();
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) { next(error); }
}
