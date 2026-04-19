# iTECHS Frontend

React + Vite single-page app for students, teachers, and super admins.

## Route Surface

- `/login`
- `/student`
- `/student/games/:gameType`
- `/student/games/:gameType/levels/:levelNumber/play`
- `/teacher`
- `/admin`
- `/admin/level-editor`

## Important Frontend Changes

- Heavy routes are lazy-loaded to keep the initial bundle lighter
- `SUPER_ADMIN` is the only admin role used in routing/auth helpers
- The admin level editor is a first-class route instead of a two-step screen
- Frontend game-track helpers now handle presentation/sorting only
- Student gameplay requests published level content from the backend
- Editor local storage is only an unsaved local draft buffer
- The largest route files now delegate loading concerns to feature hooks:
  - `features/admin/useAdminDirectory.js`
  - `features/student/useStudentGameCatalog.js`
  - `features/teacher/useTeacherDashboardData.js`

## Scripts

```bash
npm run dev
npm test
npm run build
```

## Smoke Tests

`npm test` currently covers the admin UX regression that started this slice:

- `Open Level Editor` navigates directly to `/admin/level-editor`
- the old `Open Full Screen Editor` CTA is no longer rendered
