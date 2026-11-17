import "dotenv/config";
import mongoose from "mongoose";
import { COURSES } from "../FrontEnd/src/components/data/coursesData.js";
import Course from "./models/Course.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be configured");
await mongoose.connect(process.env.MONGO_URI);
const docs = COURSES.map((course) => ({
  _id: String(course.id), title: course.t, category: course.cat, icon: course.ic,
  colorIndex: course.c, instructor: course.by,
  lessons: course.v.map(([title, video, questions]) => ({ title, video, questions: (questions || []).map(([question, options, correctIndex]) => ({ question, options, correctIndex })) })),
}));
await Course.bulkWrite(docs.map((document) => ({ replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true } })));
console.log(`Seeded ${docs.length} courses and ${docs.reduce((n, course) => n + course.lessons.length, 0)} lessons.`);
await mongoose.disconnect();
