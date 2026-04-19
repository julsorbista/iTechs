# iTECHS Backend

Express + Prisma API for authentication, user management, teacher/student progression, and admin-managed level content.

## Structure

```text
Backend/
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|   `-- seed.js
|-- src/
|   |-- app.js
|   |-- lib/prisma.js
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- routes/
|   `-- services/
|-- tests/
|   `-- api.smoke.test.js
`-- server.js
```

## Important Backend Changes

- Shared Prisma client via `src/lib/prisma.js`
- `src/app.js` now builds the Express app so tests can run without booting the server
- New `LevelContent` model for backend-owned editor drafts and published payloads
- Real relation from `LevelAttempt.sessionId` to `GameSession`
- `ContentFlag` now points to `levelId`
- `TeacherStudentPolicy` keeps composite teacher-student uniqueness without a global `studentId` uniqueness constraint

## API Surfaces

### Auth

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`
- `POST /api/auth/change-password`

### Users / Teacher Tools

- `GET /api/users`
- `GET /api/users/my-students/roster`
- `GET /api/users/my-students/:studentId/progress`
- `PATCH /api/users/my-students/:studentId/policy`
- `POST /api/users/my-students/:studentId/flags`

### Student Levels

- `GET /api/levels/games/me`
- `GET /api/levels/me?gameType=GAME_ONE`
- `GET /api/levels/:gameType/:levelNumber/content`
- `POST /api/levels/:gameType/:levelNumber/sessions/start`
- `POST /api/levels/:gameType/:levelNumber/sessions/:sessionId/submit`

### Admin Level Content

- `GET /api/admin/levels/catalog`
- `GET /api/admin/levels/:gameType/:levelNumber/content`
- `PUT /api/admin/levels/:gameType/:levelNumber/content/draft`
- `POST /api/admin/levels/:gameType/:levelNumber/content/publish`

### Admin AI Tools

- `POST /api/admin/ai/questions/generate`

## Environment Variables

Gemini for AI Question Devtool:

- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (optional, default `gemini-2.5-flash`)
- `GEMINI_API_URL` (optional, default `https://generativelanguage.googleapis.com/v1beta/models`)
- `GEMINI_REQUEST_TIMEOUT_MS` (optional, backend request timeout in milliseconds, default `60000`)
- `GEMINI_MAX_OUTPUT_TOKENS` (optional, max output tokens per request, default adaptive)
- `DYNAMIC_QUESTION_CACHE_TTL_MS` (optional, in-memory dynamic question cache TTL in milliseconds, default `0`)
- `DYNAMIC_QUESTION_POOL_PERSISTENCE_ENABLED` (optional, enable DB-backed dynamic variant pooling, default `true`)
- `DYNAMIC_QUESTION_POOL_TTL_MS` (optional, DB variant reuse window in milliseconds, default `259200000`)
- `DYNAMIC_QUESTION_ASSIGNMENT_TTL_MS` (optional, per-login assignment stability window in milliseconds, default `86400000`)
- `DYNAMIC_QUESTION_POOL_CANDIDATE_LIMIT` (optional, candidate variants considered per assignment, default `20`)
- `DYNAMIC_QUESTION_RECENT_EXCLUSIONS` (optional, exclude this many recent variants for same student when possible, default `3`)
- `DYNAMIC_QUESTION_POOL_PRUNE_INTERVAL_MS` (optional, minimum time between prune passes, default `60000`)

## Scripts

```bash
npm run dev
npm start
npm run db:generate
npx prisma migrate deploy
npm test
```

## Smoke Tests

`npm test` covers:

- login + profile resolution
- admin draft/publish workflow
- student access to published level payloads
- student start/submit progression flow
