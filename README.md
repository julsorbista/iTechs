# iTECHS Learning Platform

iTECHS is a role-based learning platform with a React/Vite frontend, an Express/Prisma backend, student progression tracking, teacher oversight tools, and a backend-managed admin level editor flow.

## Current Architecture

```text
iTECHS/
|-- Backend/
|   |-- prisma/                  # Prisma schema, migrations, seed
|   |-- src/
|   |   |-- app.js               # Express app factory for runtime + tests
|   |   |-- lib/prisma.js        # Shared Prisma singleton
|   |   |-- config/              # Game catalog + level content seed catalog
|   |   |-- controllers/         # HTTP handlers
|   |   |-- middleware/          # Auth + validation
|   |   |-- routes/              # API routers
|   |   `-- services/            # Progression + level content services
|   `-- tests/                   # Backend smoke tests
|-- Frontend/
|   |-- src/
|   |   |-- components/          # Shared UI
|   |   |-- features/            # Admin, student, teacher, level editor features
|   |   |-- pages/               # Route shells
|   |   |-- test/                # Vitest setup
|   |   `-- utils/               # API client + helpers
|   `-- vite.config.js           # Build + test config
`-- README.md
```

## Key Implementation Notes

- `SUPER_ADMIN` is the canonical admin role in the frontend and backend.
- The admin `Level Editor` action now navigates directly to `/admin/level-editor`.
- Level content is backend-owned through `LevelContent` records with separate `draftJson` and `publishedJson`.
- Student gameplay loads published content from the backend, not from static frontend JSON or local draft state.
- Local storage in the editor is now only used for unsaved local edits before a draft save.
- Route-level lazy loading is enabled for the heavy admin, editor, and gameplay screens.
- Placeholder `/shell/*` routes and the frontend-only `ADMIN` alias were removed.
- `GAME_ONE` has seeded/editor-supported runtime content today; other tracks use backend catalog records and fallback content until their editor/runtime assets are added.

## Core Flows

### Admin Level Content

1. Open `/admin`.
2. Click `Open Level Editor`.
3. Save a draft to persist editor changes to `LevelContent.draftJson`.
4. Publish to update the student-playable `LevelContent.publishedJson`.

### Student Gameplay

1. Student opens a game track.
2. Frontend requests `/api/levels/:gameType/:levelNumber/content`.
3. Backend returns the published level payload.
4. Session start/submit continues through the progression service and Prisma models.

## Setup

### Backend

```bash
cd Backend
npm install
npm run db:generate
npx prisma migrate deploy
npm run dev
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

## Validation

### Backend

```bash
cd Backend
npx prisma validate
npm test
```

### Frontend

```bash
cd Frontend
npm test
npm run build
```

## Smoke Test Coverage

- Backend:
  - auth login + `/api/auth/profile`
  - admin level draft/save/publish endpoints
  - student playable content fetch
  - student session start/submit progression flow
- Frontend:
  - direct admin navigation to `/admin/level-editor`
  - regression guard that the old `Open Full Screen Editor` CTA is gone
