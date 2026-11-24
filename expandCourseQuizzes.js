import "./config/environment.js";
import { validateEnvironment } from "./config/environment.js";
import mongoose from "mongoose";
import Course from "./models/Course.js";
import { ensureTenQuizQuestions } from "./seedQuizQuestions.js";

validateEnvironment(["MONGO_URI"]);
await mongoose.connect(process.env.MONGO_URI, { dbName: "SkillhubDB" });
const dryRun = process.argv.includes("--dry-run");

try {
  const courses = await Course.find().lean();
  let updatedCourses = 0;
  let updatedLessons = 0;

  for (const course of courses) {
    let changed = false;
    const lessons = (course.lessons || []).map((lesson) => {
      const isTuple = Array.isArray(lesson);
      const title = isTuple ? lesson[0] : lesson?.title;
      const questions = isTuple ? lesson[2] : lesson?.questions;
      if (!Array.isArray(questions) || questions.length === 0) return lesson;

      const tuples = questions.map((question) =>
        Array.isArray(question)
          ? question
          : [question?.question, question?.options, question?.correctIndex],
      );
      const expanded = ensureTenQuizQuestions(String(course._id), title, tuples);
      if (expanded.length === questions.length) return lesson;

      changed = true;
      updatedLessons += 1;
      const normalized = expanded.map(([question, options, correctIndex]) => ({
        question,
        options,
        correctIndex,
      }));
      return isTuple
        ? [lesson[0], lesson[1], normalized]
        : { ...lesson, questions: normalized };
    });

    if (!changed) continue;
    if (!dryRun) await Course.updateOne({ _id: course._id }, { $set: { lessons } });
    updatedCourses += 1;
  }

  console.log(
    `${dryRun ? "Would expand" : "Expanded"} quizzes in ${updatedLessons} lessons across ${updatedCourses} courses.`,
  );
} finally {
  await mongoose.disconnect();
}
