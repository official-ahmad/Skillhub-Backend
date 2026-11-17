# Skillhub API

## Local setup

1. Copy `.env.example` to `.env` and set `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, `GOOGLE_CLIENT_ID`, and the deployed frontend origin in `FRONTEND_URL`.
2. Install and seed the bundled catalog:

   ```sh
   npm install
   npm run seed
   npm start
   ```

The API listens on `PORT` (default `8005`). The seed command imports the existing 16 courses and 123 lessons from `FrontEnd/src/components/data/coursesData.js` and upserts them by course ID, so it can be run again safely.

## API routes

- `GET /` health response
- `GET /api/courses` and `GET /api/courses/:courseId`
- `POST /api/auth/google` accepts `{ "credential": "<Google ID token>" }`
- `GET /api/auth/me` and `PATCH /api/auth/profile` (Bearer JWT)
- `GET /api/progress`, `PUT /api/progress/:courseId`, `PUT /api/progress/:courseId/notes/:lessonIndex`, `DELETE /api/progress`, and `GET /api/progress/leaderboard` (Bearer JWT)
- `POST /api/progress/migrate` imports existing browser-stored lesson progress and notes once per account (Bearer JWT)
