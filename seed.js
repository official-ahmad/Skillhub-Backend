import "./config/environment.js";
import { validateEnvironment } from "./config/environment.js";
import mongoose from "mongoose";
import User from "./models/User.js";
import Course from "./models/Course.js";
import Enrollment from "./models/Enrollment.js";
import Progress from "./models/Progress.js";

validateEnvironment(["MONGO_URI"]);

const roster = [
  "Areeba Ahmed",
  "Abdullah Khan",
  "Ayesha Raza",
  "Hamza Ali",
  "Hira Shah",
  "Ibrahim Malik",
  "Maryam Noor",
  "Muhammad Ahmad",
  "Fatima Zahra",
  "Hassan Rauf",
  "Laiba Hussain",
  "Saad Qureshi",
  "Anaya Tariq",
  "Usman Javed",
  "Zainab Iqbal",
  "Bilal Ahmed",
  "Eman Khalid",
  "Daniyal Aslam",
  "Maham Yousaf",
  "Huzaifa Butt",
  "Amina Sheikh",
  "Rayyan Haider",
  "Sana Farooq",
  "Ali Mustafa",
  "Iqra Mehmood",
  "Talha Nadeem",
  "Noor Fatima",
  "Shahzaib Akram",
  "Kinza Bibi",
  "Omar Farooq",
  "Aleena Jamil",
  "Muneeb Arshad",
  "Rida Faisal",
  "Abdul Rehman",
  "Sarah Imran",
  "Kashif Mehmood",
  "Mehwish Asghar",
  "Umar Siddiqui",
  "Nimra Asif",
  "Ahmad Raza",
  "Hafsa Amin",
  "Danish Ilyas",
  "Mishal Saleem",
  "Taha Masood",
  "Sadia Anwar",
  "Waleed Ahmed",
  "Anum Khalid",
  "Fahad Mirza",
  "Zoya Hassan",
  "Usama Tariq",
];

const lessons = (items) =>
  items.map(([title, video, duration]) => ({
    title,
    video,
    videoUrl: `https://www.youtube.com/watch?v=${video}`,
    duration,
    questions: [],
  }));
const courses = [
  {
    _id: "python",
    title: "Python programming",
    category: "Programming",
    tags: ["Python", "Foundations", "BSSE"],
    icon: "code",
    colorIndex: 0,
    instructor: "Dr. Ayesha Siddiqui",
    level: "Beginner",
    description:
      "Build a strong programming foundation with Python, from clear first principles to small working programs.",
    lessons: lessons([
      ["Variables and data types", "t2_Q2BRzeEE", 18],
      ["Strings and conditionals", "lIId8IDP6TU", 22],
      ["Lists and tuples", "qVyvmzFxF_o", 31],
      ["Dictionaries and sets", "078tYSD7K8E", 27],
      ["Loops", "S73thl0AyFU", 34],
      ["Functions and recursion", "OvTH-7ESoRA", 29],
    ]),
  },
  {
    _id: "web-development",
    title: "Web development",
    category: "Web development",
    tags: ["HTML", "CSS", "JavaScript"],
    icon: "layers",
    colorIndex: 1,
    instructor: "Engr. Hamza Rauf",
    level: "Beginner",
    description:
      "Understand how the browser turns structure, styles, and interaction into useful interfaces.",
    lessons: lessons([
      ["HTML structure and semantics", "GkZN_-HMCJ8", 16],
      ["HTML lists and tables", "AJ4E1zf5tQs", 24],
      ["CSS box model", "MluY-_FUxFI", 35],
      ["Flexbox layout", "KD5mNp8PTko", 42],
      ["JavaScript variables and types", "ajdRvxDWH4w", 25],
      ["JavaScript operators and conditions", "Zg4-uSjxosE", 30],
    ]),
  },
  {
    _id: "oop",
    title: "Object-oriented programming",
    category: "Programming",
    tags: ["Java", "OOP", "Design"],
    icon: "terminal",
    colorIndex: 2,
    instructor: "Dr. Bilal Ahmed",
    level: "Intermediate",
    description:
      "Model software with classes and objects, then use encapsulation, inheritance, and interfaces with care.",
    lessons: lessons([
      ["Java classes and objects", "bSrm9RXwBaI", 22],
      ["Constructors and encapsulation", "yRpLlJmRo2w", 26],
      ["Inheritance and composition", "LusTv0RlnSU", 29],
      ["Polymorphism and interfaces", "I5srDu75h_M", 31],
      ["Exceptions and generics", "0r1SfRoLuzU", 27],
      ["Design a small class model", "qcSz4ef9UHA", 33],
    ]),
  },
  {
    _id: "database-systems",
    title: "Database systems",
    category: "Data",
    tags: ["SQL", "MongoDB", "Data modeling"],
    icon: "database",
    colorIndex: 3,
    instructor: "Ms. Maryam Noor",
    level: "Intermediate",
    description:
      "Go from relational modeling to practical queries, constraints, and indexes.",
    lessons: lessons([
      ["SQL introduction and commands", "323H_mOOWQ4", 20],
      ["Create tables and choose data types", "R6Ps7aUNPE4", 25],
      ["Modify table structure", "NA3b8JRUmww", 37],
      ["Delete, drop, and truncate", "_m1aJdD-oD8", 29],
      ["Queries, filters, and operators", "_yog7h4BokQ", 26],
      ["Grouping and having", "apNmMWgFFRg", 30],
    ]),
  },
  {
    _id: "data-structures",
    title: "Data structures",
    category: "Computer science",
    tags: ["Algorithms", "DSA", "Problem solving"],
    icon: "network",
    colorIndex: 4,
    instructor: "Engr. Saad Qureshi",
    level: "Intermediate",
    description:
      "Choose the right structures for common problems and reason about their cost.",
    lessons: lessons([
      ["Data structures and complexity", "xX5iOYCJmBI", 23],
      ["Linked lists", "N6dOwBde7-M", 28],
      ["Stacks", "KInG04mAjO0", 24],
      ["Trees and hash tables", "FsfRsGFHuv4", 34],
      ["Queues", "nqXaPZi99JI", 27],
      ["Linear and binary search", "xrMppTpoqdw", 32],
    ]),
  },
  {
    _id: "software-engineering",
    title: "Software engineering",
    category: "Engineering",
    tags: ["Requirements", "Testing", "Git"],
    icon: "git-branch",
    colorIndex: 5,
    instructor: "Dr. Sana Farooq",
    level: "Beginner",
    description:
      "Practice the teamwork and engineering habits that make software dependable and maintainable.",
    lessons: lessons([
      ["Version control with Git", "Ez8F0nW6S-w", 19],
      ["Command line and project files", "4IIlZRabmV8", 28],
      ["Permissions and shared repositories", "Zysmaewb2wE", 26],
      ["Automating repeatable work", "TtGM9GfBuok", 31],
      ["Remote collaboration with SSH", "Ei3nU-fHI6E", 25],
      ["Deploy and maintain a web service", "TQR0sPgVpEg", 29],
    ]),
  },
];

const userDocs = roster.map((name, index) => {
  const studentId = String(2601616 + index);
  const enrolledCourses = courses
    .filter(
      (_, courseIndex) =>
        index % 7 !== 0 || courseIndex === index % courses.length,
    )
    .map(({ _id }) => _id);
  const progress = new Map(
    enrolledCourses.map((courseId) => [
      courseId,
      (index * 3 + courses.findIndex((course) => course._id === courseId) * 2) %
        7,
    ]),
  );
  return {
    name,
    studentId,
    email: `${studentId}@students.au.edu.pk`,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e9e5db&color=252821&size=128`,
    className: "BSSE - Evening",
    cohort: "au-bsse-evening-2026",
    enrolledCourses,
    progress,
    notes: new Map(),
    bookmarks: [],
  };
});

for (const course of courses)
  course.duration = course.lessons.reduce(
    (total, lesson) => total + lesson.duration,
    0,
  );

await mongoose.connect(process.env.MONGO_URI, { dbName: "SkillhubDB" });
try {
  await Course.bulkWrite(
    courses.map((course) => ({
      replaceOne: {
        filter: { _id: course._id },
        replacement: course,
        upsert: true,
      },
    })),
  );
  const courseIds = courses.map(({ _id }) => _id);
  await Promise.all([
    Course.deleteMany({ _id: { $nin: courseIds } }),
    Enrollment.deleteMany({ course: { $nin: courseIds } }),
    Progress.deleteMany({ course: { $nin: courseIds } }),
  ]);
  for (const user of userDocs) {
    const { progress, ...profile } = user;
    await User.updateOne(
      { email: user.email },
      {
        $set: profile,
        $setOnInsert: { progress, notes: new Map(), bookmarks: [] },
      },
      { upsert: true, runValidators: true },
    );
  }

  const students = await User.find({
    email: { $in: userDocs.map((user) => user.email) },
  })
    .select("_id email studentId")
    .lean();
  const studentByEmail = new Map(
    students.map((student) => [student.email, student]),
  );
  const enrollments = [];
  const progressRecords = [];
  for (
    let studentIndex = 0;
    studentIndex < userDocs.length;
    studentIndex += 1
  ) {
    const user = userDocs[studentIndex];
    const saved = studentByEmail.get(user.email);
    for (let courseIndex = 0; courseIndex < courses.length; courseIndex += 1) {
      const course = courses[courseIndex];
      const enrolled =
        studentIndex % 7 !== 0 || courseIndex === studentIndex % courses.length;
      if (!enrolled) continue;
      enrollments.push({
        updateOne: {
          filter: { student: saved._id, course: course._id },
          update: {
            $setOnInsert: {
              student: saved._id,
              course: course._id,
              enrolledAt: new Date(Date.UTC(2026, 8, 1)),
            },
          },
          upsert: true,
        },
      });
      const completedLessons =
        (studentIndex * 3 + courseIndex * 2) % (course.lessons.length + 1);
      if (completedLessons > 0)
        progressRecords.push({
          updateOne: {
            filter: { student: saved._id, course: course._id },
            update: {
              $setOnInsert: {
                student: saved._id,
                course: course._id,
                completedLessons,
                updatedAt: new Date(),
              },
            },
            upsert: true,
          },
        });
    }
  }
  if (enrollments.length) await Enrollment.bulkWrite(enrollments);
  if (progressRecords.length) await Progress.bulkWrite(progressRecords);
  console.log(
    `Seeded ${userDocs.length} BSSE students, ${courses.length} courses, ${enrollments.length} enrollments, and ${progressRecords.length} progress records.`,
  );
} finally {
  await mongoose.disconnect();
}
