# Skillhub API

## Local setup

1. Copy `.env.example` to `.env` and set `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, `GOOGLE_CLIENT_ID`, and the deployed frontend origin in `FRONTEND_URL`.
2. Install and seed the bundled catalog:

   ```sh
   npm install
   npm run seed
   npm start
   ```

The API and seed command use the `SkillhubDB` database from the configured MongoDB Atlas URI. The idempotent seed creates the 50-student BSSE Evening roster, six core courses with six lessons each, and sample enrollment and progress records. It synchronizes the course collection to these six core courses and can be rerun safely.

## API routes

- `GET /` health response
- `GET /api/courses` and `GET /api/courses/:courseId`
- `GET /api/students/leaderboard` returns the seeded class roster and standings
- `POST /api/auth/google` accepts `{ "credential": "<Google ID token>" }`
- `GET /api/auth/me` and `PATCH /api/auth/profile` (Bearer JWT)
- `GET /api/progress`, `PUT /api/progress/:courseId`, `PUT /api/progress/:courseId/notes/:lessonIndex`, and `DELETE /api/progress` (Bearer JWT)
- `POST /api/progress/migrate` imports existing browser-stored lesson progress and notes once per account (Bearer JWT)
