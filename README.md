# Skillhub API

## Local setup

1. Copy `.env.example` to `.env` and set `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, `GOOGLE_CLIENT_ID`, and the deployed frontend origin in `FRONTEND_URL`.
   `YOUTUBE_API_KEY` is optional; when configured, playlist imports expand into individual lesson videos and YouTube channel avatar lookup uses the Data API. Without it, the API uses oEmbed/public channel metadata where available and falls back to a playable playlist lesson.
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
- Admin-only `POST /api/admin/courses/bulk`, `/courses/resolve-youtube`, and `/courses/resolve-instructor` support spreadsheet imports and YouTube metadata lookup.
- `GET /api/students/leaderboard` returns the seeded class roster and standings
- `POST /api/auth/google` accepts `{ "credential": "<Google ID token>" }`
- `GET /api/auth/me` and `PATCH /api/auth/profile` (Bearer JWT)
- `GET /api/progress`, `PUT /api/progress/:courseId`, `PUT /api/progress/:courseId/notes/:lessonIndex`, and `DELETE /api/progress` (Bearer JWT)
- `POST /api/progress/migrate` imports existing browser-stored lesson progress and notes once per account (Bearer JWT)
