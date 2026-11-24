const examples = {
  js: ['const total = 2 + 3; console.log(total);', "5"],
  py: ["total = 2 + 3\nprint(total)", "5"],
  html: ["<strong>Ready</strong>", "The word Ready renders in bold"],
  css: [".card { display: grid; }", "The element uses CSS Grid layout"],
  c: ["int total = 2 + 3; printf(\"%d\", total);", "5"],
  java: ["int total = 2 + 3; System.out.println(total);", "5"],
  cpp: ["int total = 2 + 3; std::cout << total;", "5"],
  sql: ["SELECT 2 + 3 AS total;", "A row with total equal to 5"],
  git: ["git status --short", "A compact list of changed and untracked files"],
  react: ["[\"a\", \"b\"].map((x) => x.toUpperCase()).join(\",\")", "A,B"],
  node: ["console.log(2 + 3);", "5"],
  dsa: ["const stack = [2, 4]; stack.pop(); stack.length;", "1"],
  linux: ["printf '%s\\n' $((2 + 3))", "5"],
  ts: ["const total: number = 2 + 3; console.log(total);", "5"],
  django: ["total = 2 + 3\nprint(total)", "5"],
  flutter: ["final total = 2 + 3; print(total);", "5"],
};

const syntaxExamples = {
  js: "const count = 3;",
  py: "count = 3",
  html: '<button type="button">Save</button>',
  css: ".card { display: grid; }",
  c: "int count = 3;",
  java: "int count = 3;",
  cpp: "int count = 3;",
  sql: "SELECT id FROM items;",
  git: "git status --short",
  react: "function Panel() { return <p>Ready</p>; }",
  node: 'import { readFile } from "node:fs/promises";',
  dsa: "const middle = Math.floor((low + high) / 2);",
  linux: "chmod 640 notes.txt",
  ts: "const count: number = 3;",
  django: 'path("items/", views.items, name="items")',
  flutter: "final count = 3;",
};

const distractors = [
  "It is valid and can be checked with a small, representative input.",
  "It is valid only after disabling errors and skipping validation.",
  "It silently converts every input into the same output.",
  "It changes unrelated application state before the result is known.",
];

function makeQuestion(question, options, correctIndex = 0) {
  return [question, options, correctIndex];
}

export function ensureTenQuizQuestions(courseId, lessonTitle, questions = []) {
  const existing = Array.isArray(questions) ? [...questions] : [];
  if (existing.length >= 10) return existing.slice(0, 10);

  const topic = String(lessonTitle || "this lesson").replace(/^[#\d.\s:-]+/, "").trim();
  const languageExample = examples[courseId] || examples.js;
  const syntaxExample = syntaxExamples[courseId] || syntaxExamples.js;
  const [code, output] = languageExample;
  const additions = [
    makeQuestion(
      `Concept check: when applying ${topic}, which workflow best confirms the chosen concept fits the requirement?`,
      [
        "Apply the relevant construct to the requirement, then verify its behavior with a small example.",
        "Choose syntax by appearance and assume it behaves the same in every context.",
        "Replace the requirement with an unrelated feature that is easier to implement.",
        "Skip checking behavior because the code looks familiar.",
      ],
    ),
    makeQuestion(
      `Output prediction for ${topic}: what does this ${courseId.toUpperCase()} example produce or mean?\n${code}`,
      [output, "It always produces a syntax error.", "It produces an empty result.", "It changes the source code without running."],
    ),
    makeQuestion(
      `Syntax check: which example is valid ${courseId.toUpperCase()} syntax that could be used while working with ${topic}?`,
      [syntaxExample, `${syntaxExample} ???`, syntaxExample.replace(/\w+/, "1invalid"), "<syntax that is not part of this language>"],
    ),
    makeQuestion(
      `Debugging ${topic}: a small change gives an unexpected result. What is the best first step?`,
      [
        "Reproduce the issue with a minimal input and inspect the values at the point where behavior diverges.",
        "Suppress the warning and add more unrelated code until the result changes.",
        "Rewrite the whole feature before confirming which input causes the issue.",
        "Assume the runtime is wrong and avoid checking the documented behavior.",
      ],
    ),
    makeQuestion(
      `Best practice: before shipping a feature that uses ${topic}, what should you do?`,
      [
        "Check normal and edge cases, keep the change focused, and verify the result in its real context.",
        "Test only the easiest case and remove checks that expose failures.",
        "Duplicate the implementation in several places so each copy can drift independently.",
        "Optimize before measuring and avoid documenting important assumptions.",
      ],
    ),
  ];

  return [...existing, ...additions.slice(0, Math.max(0, 10 - existing.length))];
}
