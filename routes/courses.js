import { Router } from "express";
import { getCourse, listCourses } from "../controllers/courseController.js";
const router = Router();
router.get("/", listCourses);
router.get("/:courseId", getCourse);
export default router;
