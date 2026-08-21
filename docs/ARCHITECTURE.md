# StudyFlow Architecture

StudyFlow is a local-first React 19 and TypeScript application built with Vite. `src/main.tsx` mounts `src/app/App.tsx`; the isolated visual preview is selected by query string and never opens the production database.

## Structure and responsibilities

- `shared/schemas/`: Zod contracts shared by UI, repositories, and backups. `Task`, `StudySession`, `MeditationSession`, `GrowthRecord`, and `PlanningPeriod` are the main durable models.
- `src/db/`: Dexie repositories. `StudyFlowDatabase` owns IndexedDB version upgrades. Repositories enforce task/category references, one active session across focus and meditation, optimistic revisions, and backup integrity.
- `src/domain/`: pure task ordering, Eisenhower grouping, execution interval accounting, growth-stage calculation, and meditation timing.
- `src/features/`: thin adapters that publish a `BroadcastChannel` update after mutations.
- `src/pages/` and `src/components/`: React UI for planning, Today, Focus, History, categories, and recovery.

## Persistence and migration

Dexie schema v5 adds `dailyReviews` alongside `planningPeriods`, while retaining backward-compatible task defaults for plan linkage, Today #1, avoidance count, and minimum start. Existing records remain preserved; older backups import safely and exports now use backup format v5.

## State machines and recovery

Focus uses `running`, `paused`, `awaiting-confirmation`, `sleep-review`, and `finished`; meditation uses the equivalent breathing/running states. Active interval boundaries, pause intervals, and sleep gaps are persisted. A revision number prevents stale tabs from applying a second mutation. Finishing persists the interval end before reflection data; sessions shorter than one effective minute are discarded.

## Tests and technical debt

## Progressive Web App

`vite-plugin-pwa` emits the web manifest, Workbox service worker, and revisioned precache during `npm.cmd run build`. It caches only same-origin application assets; IndexedDB stays outside the cache and remains the source of personal data. `src/pwa.ts` uses prompt registration and `PwaUpdatePrompt` exposes a waiting update without reloading a running session.

Vitest covers domain calculations, repositories, backups, growth, and meditation; Playwright covers core flows and visual snapshots. Do not casually refactor interval accounting, backup validation, or repository transactions: they protect the Plan → Execute → Record audit trail. Styling remains concentrated in the existing large global/nature CSS files, and the App shell is intentionally dense; future changes should prefer extracting focused components rather than rewriting timer orchestration.
