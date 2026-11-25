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

const gitMarathonQuestions = [
  makeQuestion(
    "What does HEAD normally identify in a Git repository?",
    ["The commit currently checked out in the working tree", "The newest remote branch", "The global .gitignore file", "The latest release tag on GitHub"],
  ),
  makeQuestion(
    "Which command shows the changes staged for the next commit?",
    ["git diff --cached", "git status --branch-only", "git log --staged", "git show --working-tree"],
  ),
  makeQuestion(
    "You ran `git add app.js` by mistake. Which command unstages that file without deleting its edits?",
    ["git restore --staged app.js", "git clean app.js", "git reset --hard app.js", "git checkout -- app.js"],
  ),
  makeQuestion(
    "What does `git fetch origin` do?",
    ["Downloads remote refs and objects without merging them into the current branch", "Deletes local commits that are not on origin", "Commits all staged files", "Creates a new GitHub repository"],
  ),
  makeQuestion(
    "A file listed in `.gitignore` is already tracked. What is required for Git to stop tracking it while keeping it on disk?",
    ["Remove it from the index with `git rm --cached <file>`, then commit that change", "Add another matching line to `.gitignore`", "Rename the repository's default branch", "Run `git stash` and leave the file staged"],
  ),
  makeQuestion(
    "Git reports a merge conflict in a source file. What is the correct next step?",
    ["Review the conflict markers, edit the intended result, then stage and commit the resolution", "Delete the entire file and immediately push", "Run `git clean -fd` to accept both sides", "Rename the remote before reading the conflict"],
  ),
  makeQuestion(
    "Which workflow is best for a small feature that should not affect the main branch until it is reviewed?",
    ["Create a focused feature branch, commit the change, and open a review request", "Make every change directly on main and skip review", "Commit generated files to a new remote for every edit", "Keep the change only in the working tree"],
  ),
  makeQuestion(
    "What does `git pull` generally do?",
    ["Fetches remote changes and integrates them into the current branch", "Uploads local commits without checking the remote", "Creates a commit from unstaged files", "Removes all local branches"],
  ),
  makeQuestion(
    "A teammate has already pulled a commit you pushed. Why should you avoid amending and force-pushing that shared commit?",
    ["Rewriting shared history can make teammates' local branches diverge and require recovery", "Amending changes the repository's .gitignore automatically", "Force-pushing turns the commit into a tag", "Git does not allow commits to be amended"],
  ),
  makeQuestion(
    "You need to apply one existing commit from another branch without merging that whole branch. Which command is designed for this?",
    ["git cherry-pick <commit>", "git stash <commit>", "git init <commit>", "git remote add <commit>"],
  ),
];

function makeQuestion(question, options, correctIndex = 0) {
  return [question, options, correctIndex];
}

export function ensureTenQuizQuestions(courseId, lessonTitle, questions = []) {
  const existing = Array.isArray(questions) ? [...questions] : [];
  const targetCount = courseId === "git" ? 20 : 10;
  if (existing.length >= targetCount) return existing.slice(0, targetCount);

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

  const poolAdditions = courseId === "git" ? [...additions, ...gitMarathonQuestions] : additions;
  return [...existing, ...poolAdditions.slice(0, Math.max(0, targetCount - existing.length))];
}
