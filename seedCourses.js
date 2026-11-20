import "./config/environment.js";
import { validateEnvironment } from "./config/environment.js";
import mongoose from "mongoose";
import { COURSES } from "../FrontEnd/src/components/data/coursesData.js";
import Course from "./models/Course.js";
import { getCourseImage, getCreatorChannel, getInstructorPhoto } from "../FrontEnd/src/components/data/assetMappings.js";

validateEnvironment(["MONGO_URI"]);
await mongoose.connect(process.env.MONGO_URI);
const docs = COURSES.map((course) => ({
  _id: String(course.id),
  title: course.t,
  category: course.cat,
  image: getCourseImage({ id: course.id }),
  icon: course.ic,
  colorIndex: course.c,
  instructor: course.by,
  instructorPhoto: getInstructorPhoto({ by: course.by }),
  instructorUrl: getCreatorChannel({ by: course.by }).url,
  instructorUrlVerified: getCreatorChannel({ by: course.by }).verified,
  lessons: course.v.map(([title, video, questions]) => ({
    title,
    video,
    questions: (questions || []).map(([question, options, correctIndex]) => ({
      question,
      options,
      correctIndex,
    })),
  })),
}));
await Course.bulkWrite(
  docs.map((document) => ({
    replaceOne: {
      filter: { _id: document._id },
      replacement: document,
      upsert: true,
    },
  })),
);
console.log(
  `Seeded ${docs.length} courses and ${docs.reduce((n, course) => n + course.lessons.length, 0)} lessons.`,
);
await mongoose.disconnect();
