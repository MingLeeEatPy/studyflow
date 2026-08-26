# StudyFlow Cross-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在保留 IndexedDB 离线能力的前提下，让同一用户在电脑和手机之间同步任务、计划、专注、冥想、成长与复盘数据。

**Architecture:** Supabase Auth 提供邮箱魔法链接登录，Supabase Postgres 保存按用户隔离的同步实体；IndexedDB 继续作为本地首选读写层。应用通过 outbox 队列记录本地变更，在线时批量上传并拉取远端变更；首次登录先创建本地备份，再由用户确认合并。可覆盖的历史数据使用追加式实体，任务与计划使用 `updatedAt` 冲突策略。

**Tech Stack:** React + TypeScript + Dexie/IndexedDB、Supabase JS client、Vitest、Playwright、Cloudflare Pages。

## Global Constraints

- 本阶段不删除或重建现有本地数据，不改变 Today、History、Garden 的既有交互。
- IndexedDB 必须继续支持离线使用；网络不可用、通知权限拒绝或 Supabase 暂时不可用时，计时和本地记录不能失败。
- 首次登录必须先生成本地安全备份，并明确提供“合并本地数据”确认，不得静默覆盖本地数据。
- 任务/计划采用最新 `updatedAt` 冲突策略；学习会话、计时区间、成长记录、冥想会话和每日复盘采用追加式同步。
- 本阶段不提交 Supabase 密钥、不把密钥写入仓库；生产配置通过 Cloudflare 环境变量提供。
- Garden 本地改动与同步改动最后统一提交；在用户确认前不推送 GitHub 或触发 Cloudflare 部署。

---

### Task 1: 同步边界与本地 outbox 数据模型

**Files:**
- Create: `src/domain/sync.ts`
- Modify: `src/features/db.ts`（在现有 Dexie schema 中追加同步表，不重建已有表）
- Modify: `shared/schemas/models.ts`（新增同步元数据和变更记录 schema）
- Test: `tests/sync-domain.test.ts`

**Interfaces:**
- `SyncEntityType`: `category | task | planningPeriod | studySession | studyInterval | sessionRevision | growthRecord | meditationSession | meditationInterval | dailyReview | executionSettings`
- `SyncChange`: `{ id, entityType, entityId, operation: "upsert" | "delete", payload, updatedAt, createdAt, syncedAt }`
- `enqueueSyncChange(change): Promise<void>`、`pendingSyncChanges(): Promise<SyncChange[]>`、`markSyncChangesSynced(ids): Promise<void>`
- `compareByUpdatedAt(local, remote): "local" | "remote" | "equal"`

- [ ] **Step 1: Write failing tests** for enqueue/dequeue ordering, deduplication of repeated upserts for the same entity, and timestamp conflict selection.
- [ ] **Step 2: Run** `npm.cmd test -- tests/sync-domain.test.ts` and verify the new APIs fail before implementation.
- [ ] **Step 3: Add** validated schemas and a Dexie outbox table with indexes on `syncedAt` and `[entityType+entityId]`; keep records append-safe and do not alter existing session tables.
- [ ] **Step 4: Implement** queue helpers and conflict comparison; use ISO timestamps and deterministic tie-breaking by id.
- [ ] **Step 5: Run** the targeted test and `npm.cmd run typecheck`.

### Task 2: Supabase client、认证和数据库迁移

**Files:**
- Create: `src/features/supabaseClient.ts`
- Create: `supabase/migrations/001_sync_entities.sql`
- Create: `src/features/authAdapter.ts`
- Test: `tests/auth-adapter.test.ts`

**Interfaces:**
- `getSupabaseClient(): SupabaseClient | null` returns null when public runtime configuration is absent.
- `authAdapter.getUser(): Promise<AuthUser | null>`、`authAdapter.signInWithMagicLink(email): Promise<void>`、`authAdapter.signOut(): Promise<void>`.
- SQL tables use `user_id`, `entity_type`, `entity_id`, `payload jsonb`, `updated_at`, `created_at`, unique `(user_id, entity_type, entity_id)` and RLS `auth.uid() = user_id`.

- [ ] **Step 1: Add** a client factory reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; return null instead of throwing when either is absent.
- [ ] **Step 2: Add** magic-link adapter with redirect URL derived from `window.location.origin`; expose auth state changes through a small subscription interface.
- [ ] **Step 3: Write** tests for missing configuration, successful adapter calls with a mocked client, and signed-out state.
- [ ] **Step 4: Add** migration for the user-scoped entity table, RLS policies, and indexes; do not include secrets.
- [ ] **Step 5: Run** targeted tests and typecheck.

### Task 3: Local repository write hooks and first-login backup/merge

**Files:**
- Modify: `src/features/api.ts`
- Modify: existing task/category/planning/session/meditation/review repository modules
- Create: `src/features/syncService.ts`
- Modify: `src/app/App.tsx`
- Test: `tests/sync-service.test.ts`

**Interfaces:**
- `syncService.createLocalBackup(): Promise<Blob>`
- `syncService.prepareFirstMerge(userId): Promise<{ backup: Blob; summary: MergeSummary }>`
- `syncService.confirmFirstMerge(userId, strategy): Promise<MergeResult>` where strategy is `"keep-local" | "merge"`.
- Every successful local mutation enqueues one normalized upsert/delete change without delaying the UI mutation.

- [ ] **Step 1: Write** tests proving local mutation succeeds while Supabase is unavailable, changes enter outbox, and backup contains existing entities.
- [ ] **Step 2: Implement** a sync service that snapshots the existing backup format before any cloud write.
- [ ] **Step 3: Add** a merge planner: tasks/categories/plans choose by `updatedAt`; append-only entities deduplicate by stable id; invalid remote payloads are rejected and left in an error report.
- [ ] **Step 4: Add** an authenticated account panel with sign-in, backup download, merge preview, confirmation, and sign-out states; keep all existing app routes usable while signed out.
- [ ] **Step 5: Run** targeted tests, typecheck, and lint.

### Task 4: Pull/push queue and offline recovery

**Files:**
- Modify: `src/features/syncService.ts`
- Create: `src/features/syncTransport.ts`
- Modify: `src/app/App.tsx`
- Test: `tests/sync-transport.test.ts`

**Interfaces:**
- `syncTransport.push(userId, changes): Promise<PushResult>`
- `syncTransport.pull(userId, cursor): Promise<{ changes: SyncChange[]; cursor: string }>`
- `syncService.syncNow(): Promise<SyncStatus>` and `syncService.startAutoSync(): () => void`.

- [ ] **Step 1: Write** tests for push retry, pull cursor advancement, duplicate append-only records, and offline-to-online recovery.
- [ ] **Step 2: Implement** batched upsert/delete requests with RLS-scoped user id; never mark a change synced before the server acknowledges it.
- [ ] **Step 3: Apply** remote changes through existing repositories, preserving local unsynced changes and re-enqueuing resolved local winners.
- [ ] **Step 4: Start** sync on auth/network-online events and expose a small status indicator (`未登录`, `离线待同步`, `同步中`, `已同步`, `同步失败`).
- [ ] **Step 5: Run** targeted tests, the complete unit suite, typecheck, and lint.

### Task 5: End-to-end multi-device acceptance and documentation

**Files:**
- Create: `e2e/sync.spec.ts`
- Modify: `e2e/pwa.spec.ts`
- Create: `docs/SYNC_SETUP.md`
- Modify: `README.txt`

- [ ] **Step 1: Add** a mocked Supabase E2E test for magic-link signed-in state, first-login backup/merge confirmation, local offline mutation, and later sync.
- [ ] **Step 2: Verify** existing PWA install/update/offline tests still pass and no service-worker mechanism is changed.
- [ ] **Step 3: Document** required Supabase setup, SQL migration, Cloudflare environment variables, redirect URL, backup/merge behavior, and how to test two devices.
- [ ] **Step 4: Run** `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, and the relevant Playwright specs.
- [ ] **Step 5: Review** Garden plus sync changes together, then create one local commit; push only after the user confirms network and deployment timing.

## Self-review

- Covers all planned sync entities, first-login safety, offline queue, conflict rules, auth, Cloudflare configuration, and PWA regression checks.
- No Supabase credentials or school-account integration are included.
- Garden remains an independent local feature and is not migrated or regenerated.
