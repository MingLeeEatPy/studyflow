# StudyFlow v3 Personal Complete Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the local-first v3 planning, priority, activation, growth, and recovery workflow without regressing v2 execution and history.

**Architecture:** Extend the existing Dexie v3 database with a backward-compatible v4 schema. Keep planning and priority data in the task domain and add a small planning-period domain table; existing task data receives safe defaults. UI work stays in the existing React page/component structure, while repository tests protect persistence and invariant rules.

**Tech Stack:** React 19, TypeScript, Vite, Dexie/IndexedDB, Zod, Vitest, Playwright.

## Global Constraints

- Preserve existing IndexedDB user data through a Dexie schema upgrade.
- Do not add dependencies or refactor unrelated v2 execution/history code.
- Keep the product local-first; no accounts, cloud, AI, analytics dashboard, white noise, or desktop packaging.
- A task may have one weekly-plan link, one active Today #1, an avoidance counter, and an optional 1–60 minute minimum start.
- Only one unfinished task may be Today #1 at a time.
- v3 testing must use `npm.cmd` on Windows when PowerShell execution policy blocks `npm.ps1`.

---

## File Structure

- `shared/schemas/models.ts`: versioned Task, PlanningPeriod, and StudySession data contracts.
- `src/db/database.ts`: Dexie v4 schema and migration defaults.
- `src/db/planningRepository.ts`: CRUD and parent/period validation for monthly and weekly plans.
- `src/db/taskRepository.ts`: priority mutation and plan-link validation.
- `src/db/sessionRepository.ts`: record avoided core-task attempts and minimum-start session snapshots.
- `src/domain/planning.ts`, `src/domain/today.ts`, `src/domain/growth.ts`: pure selection, ordering, and growth-feedback rules.
- `src/components/PlanningPanel.tsx`, `TaskForm.tsx`, `TaskCard.tsx`, `StartSessionModal.tsx`: planning and priority controls.
- `src/pages/PlanPage.tsx`, `TodayPage.tsx`, `FocusPage.tsx`: connected planning/priority/Minimum Start experience.
- `src/db/backupRepository.ts`, `shared/schemas/backup.ts`: v4 backup and migration validation.
- `tests/*`: regression coverage for schema upgrade, priority invariants, planning hierarchy, growth weighting, and minimum starts.
- `docs/ARCHITECTURE.md`, `README.md`, `PRODUCT.md`, `ROADMAP.md`, `CODEX_HANDOFF.md`: accurate v3 documentation and Windows instructions.

### Task 1: Create data contracts and migration

**Files:**
- Modify: `shared/schemas/models.ts`, `src/db/database.ts`, `src/db/taskRepository.ts`
- Test: `tests/repository.test.ts`

- [ ] Add `PlanningPeriod` (`month` or `week`, start/end local dates, optional parent month) and nullable `planId`, `isCoreTask`, `avoidanceCount`, and `minimumStartMinutes` task fields.
- [ ] Add null/default-safe v4 Dexie migration for existing tasks and the `planningPeriods` table.
- [ ] Add tests that open a v3-shaped database, run the upgrade, and observe task defaults.
- [ ] Run `npm.cmd run test -- tests/repository.test.ts`.

### Task 2: Implement monthly and weekly planning

**Files:**
- Create: `src/db/planningRepository.ts`, `src/domain/planning.ts`, `src/components/PlanningPanel.tsx`
- Modify: `src/db/index.ts`, `src/features/api.ts`, `src/pages/PlanPage.tsx`, `src/components/TaskForm.tsx`
- Test: `tests/planning-repository.test.ts`, `tests/planning-domain.test.ts`

- [ ] Write tests for monthly period validation, weekly containment, and linking tasks to a weekly plan.
- [ ] Implement repository CRUD, chronological list ordering, and period-parent integrity checks.
- [ ] Expose a compact Plan-page hierarchy with month/week creation, deletion protection for linked tasks, and plan selection in task editing.
- [ ] Run the new tests and inspect the plan page manually.

### Task 3: Implement core priority and avoided-task feedback

**Files:**
- Modify: `src/domain/today.ts`, `src/db/taskRepository.ts`, `src/db/sessionRepository.ts`, `src/components/TaskCard.tsx`, `src/pages/TodayPage.tsx`, `src/pages/PlanPage.tsx`
- Test: `tests/domain.test.ts`, `tests/repository.test.ts`, `tests/session-repository.test.ts`

- [ ] Write failing tests for core-first task ordering, single-core replacement, and avoidance increments after an unfinished/partial core-task session.
- [ ] Implement `setCoreTask` and session-finish avoidance increments transactionally.
- [ ] Add clear Today #1 and avoided badges/actions in cards and an unambiguous core-task block on Today.
- [ ] Run focused unit tests.

### Task 4: Implement Minimum Start and weighted growth

**Files:**
- Modify: `shared/schemas/models.ts`, `src/db/sessionRepository.ts`, `src/domain/growth.ts`, `src/components/StartSessionModal.tsx`, `src/pages/FocusPage.tsx`, `src/components/TaskCard.tsx`
- Test: `tests/session-repository.test.ts`, `tests/growth-domain.test.ts`, `tests/execution-domain.test.ts`

- [ ] Add a nullable minimum-start target snapshot to study sessions and preserve it in backups.
- [ ] Make the start modal preselect the task minimum start, start Focus immediately, and show continue/finish choices exactly at its threshold.
- [ ] Give focus completed for a core task a smaller growth target, yielding visibly stronger garden progress while retaining one auditable source record.
- [ ] Run affected tests.

### Task 5: Close Meditation and backup integrity gaps

**Files:**
- Modify: `src/db/meditationRepository.ts`, `src/db/backupRepository.ts`, `src/app/App.tsx`, `src/pages/TodayPage.tsx`
- Test: `tests/meditation-repository.test.ts`, `tests/backup.test.ts`

- [ ] Write regressions proving finish freezes an active interval before reflection, validates meditation active-state linkage, and rejects invalid growth records.
- [ ] Implement any missing state/linkage checks and add a Today recovery entry point.
- [ ] Run the affected repository tests.

### Task 6: Verify and document v3

**Files:**
- Create: `docs/ARCHITECTURE.md`
- Modify: `README.md`, `PRODUCT.md`, `ROADMAP.md`, `CODEX_HANDOFF.md`, `package.json`
- Test: `e2e/core-flow.spec.ts`, new v3 Playwright flow if necessary

- [ ] Document actual architecture, tables, migration, state machines, tests, error recovery, and non-casual-refactor areas.
- [ ] Replace obsolete AI Planner commitments with: “v5 scope will be determined by dogfooding and Public Beta feedback.”
- [ ] Ensure Windows-first command documentation uses `npm.cmd` and create a v3-ready version marker.
- [ ] Run `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:e2e`.
- [ ] Inspect `git diff` and `git status`; do not commit, push, open a PR, or create a release without explicit authorization.

## Self-Review

- Scope coverage: Tasks 1–2 cover monthly/weekly hierarchy; Task 3 covers Today #1 and avoidance; Task 4 covers minimum start and stronger growth; Task 5 covers recovery and previously identified integrity risks; Task 6 performs the release gate and updates product documentation.
- No placeholders: every task identifies concrete files, invariants, and validation commands.
- Type consistency: `PlanningPeriod`, `Task.planId`, `Task.isCoreTask`, `Task.avoidanceCount`, `Task.minimumStartMinutes`, and `StudySession.minimumStartTargetSeconds` are the shared contract names.
