# iTECHS Implementation Todo (From PRD + task docs)

This todo list is prioritized to match the documented requirements and your instruction:
- Start with the most basic interface.
- Build account + role system first.
- Implement level/progression system before mini-games.
- Keep mini-games as the last major build phase.

## Working Rules

- No public self-registration. Admin creates Teacher and Student accounts only.
- Enforce RBAC server-side on all protected endpoints.
- OTP activation is required (10-minute validity).
- Login lockout policy: 5 failed attempts -> 10-minute lock.
- Keep stars (per-level mastery) separate from star currency wallet.
- Use a fixed 20-level progression model for each student.
- Teacher can review and adjust policy knobs (difficulty/star rules), but cannot directly edit question content.

## Phase 0 - Foundation + Basic Interface (No Game Logic Yet)

- [x] 0.1 Define UI design tokens in frontend (colors, spacing, borders, pixel button/panel/table styles).
- [x] 0.2 Build base app shell with landscape-first responsive layout.
- [x] 0.3 Create reusable UI components: Panel, PixelButton, IconTile, Table, Modal, FormField.
- [x] 0.4 Build role landing placeholders (no business logic yet): Admin menu, Teacher dashboard shell, Student menu shell.
- [x] 0.5 Add route structure and guarded route stubs for ADMIN/TEACHER/STUDENT.
- [x] 0.6 Add loading/error/empty states for list and table screens.
- [x] 0.7 Prepare PWA base config (manifest + icons + initial service worker setup).

Definition of done:
- Basic pixel-style interface works on desktop and mobile landscape.
- Navigation between placeholder screens works.
- Shared component library is usable across all pages.

## Phase 1 - Authentication, OTP, and RBAC (Highest Priority)

- [x] 1.1 Extend Prisma schema for auth/security entities: User, OtpToken, LoginAttempt, AccountLock, AuditLog.
- [x] 1.2 Implement password hashing and secure login endpoint.
- [x] 1.3 Implement OTP request + verify flow with 10-minute expiry.
- [x] 1.4 Enforce account status checks (pending activation, active, locked, deactivated).
- [x] 1.5 Implement failed-login tracking and 5-attempt/10-minute lockout.
- [x] 1.6 Implement RBAC middleware (deny by default; role allowlist per route).
- [x] 1.7 Implement role-based post-login routing: ADMIN -> admin, TEACHER -> teacher, STUDENT -> student.
- [x] 1.8 Add audit logs for auth/security events (login success/fail, lockout, OTP verify, role changes).
- [x] 1.9 Add backend validation for all auth payloads.

Definition of done:
- Only valid users can log in.
- Locked/inactive/unverified flows are correctly blocked.
- Role-protected endpoints are inaccessible to wrong roles.

## Phase 2 - Admin Account and Role Management

- [ ] 2.1 Build Admin user management UI (create/update/deactivate/archive for Teacher/Student).
- [ ] 2.2 Implement admin-only user CRUD endpoints with validation and search/filter.
- [ ] 2.3 Add teacher-student assignment feature (roster mapping).
- [ ] 2.4 Build archive screen and status filters.
- [ ] 2.5 Add admin audit-log viewer with filters (actor/action/date).
- [ ] 2.6 Trigger student provisioning pipeline when admin creates a student.

Definition of done:
- Admin can fully manage teacher/student accounts.
- Search/filter/archive functions are operational.
- Student creation triggers provisioning pipeline entry.

## Phase 3 - Student Level System and Progression Core (Before Mini-Games)

- [x] 3.1 Create level data models: LevelDefinition (1-20), StudentLevelState, LevelGameAssignment, GameSession.
- [x] 3.2 On student provisioning, initialize all 20 levels (Level 1 unlocked, others locked).
- [x] 3.3 Implement level unlock rule: Level N unlocks when Level N-1 completed with >= 1 star.
- [x] 3.4 Implement pair-based game assignment logic (1-2, 3-4, ... 19-20) with no consecutive pair repeats.
- [x] 3.5 Implement stars logic:
  - Start at 3 stars.
  - First 3 mistakes are free.
  - Mistakes beyond 3 reduce stars.
  - Each hint use immediately costs 1 star.
  - Fail when stars reach 0.
- [x] 3.6 Implement score logic with retry multiplier decay (example: 1.0, 0.9, 0.8 ... floor 0.5).
- [x] 3.7 Build Student level select UI with locked/unlocked/completed states + star indicators.
- [x] 3.8 Build session start/submit API contracts (game-agnostic payload first).
- [x] 3.9 Persist attempt history and best stars/best score per level.

Definition of done:
- Student progression from Level 1 to 20 works with documented unlock/star/score rules.
- Level state and attempt history are persisted and visible.

## Phase 4 - Teacher Oversight and Progress Monitoring

- [ ] 4.1 Build Teacher roster list view (assigned students only).
- [ ] 4.2 Build student detail view: level stars, score history, attempt timeline.
- [ ] 4.3 Add teacher leaderboard view for assigned roster.
- [ ] 4.4 Implement teacher policy knobs (difficulty preset, allowed overrides for star policy where permitted).
- [ ] 4.5 Implement content flag/regeneration request flow (teacher can request, not edit questions directly).

Definition of done:
- Teacher can monitor and guide assigned students without direct content editing.

## Phase 5 - AI Question Provisioning Pipeline (Still Before Mini-Games)

- [ ] 5.1 Build provisioning job system for new students (20 level packs).
- [ ] 5.2 Generate and persist question packs with status READY/FAILED_GENERATION.
- [ ] 5.3 Add retries and validation for malformed AI output.
- [ ] 5.4 Add admin endpoint/view to monitor generation status and rerun failed levels.
- [ ] 5.5 Ensure generated content is bound to student + level and versioned by prompt/model metadata.

Definition of done:
- Each student has stable per-level question packs available before gameplay.

## Phase 6 - Mini-Games Implementation (Last Major Phase)

- [ ] 6.1 Implement Game A: Hardware Parts Matching.
- [ ] 6.2 Implement Game B: CPU/Internal Hardware Assembling.
- [ ] 6.3 Implement Game C: Jigsaw Puzzle + follow-up identification questions.
- [ ] 6.4 Integrate shared HUD (stars, hint button, level info, currency display).
- [ ] 6.5 Connect each game to question pack loader and session submission pipeline.
- [ ] 6.6 Add results screen with stars earned, score earned, and corrective feedback.

Definition of done:
- All 3 mini-games work with the same progression/scoring backend contracts.

## Phase 7 - Cosmetics, Leaderboards, and Final PWA Hardening

- [ ] 7.1 Implement star currency wallet and reward rules.
- [ ] 7.2 Implement cosmetics catalog, purchase, inventory, and equip flows.
- [ ] 7.3 Implement admin global leaderboard + student/teacher leaderboard endpoints.
- [ ] 7.4 Finalize service worker caching for static assets and key screens.
- [ ] 7.5 Perform security and validation pass (RBAC checks, audit coverage, payload validation).
- [ ] 7.6 Perform acceptance QA against PRD/task requirements.

Definition of done:
- App is installable as PWA, secure, and functionally aligned to the documented MVP.

## Suggested Execution Sequence (Strict)

1. Complete Phase 0.
2. Complete Phases 1 and 2 (account and role system).
3. Complete Phase 3 (level/progression core).
4. Complete Phases 4 and 5 (teacher oversight + AI provisioning).
5. Complete Phase 6 (mini-games last).
6. Complete Phase 7 (polish and release readiness).

## First Task To Start Now

- [x] Start with task 0.1: Define and apply the base pixel UI design tokens and shell layout.
