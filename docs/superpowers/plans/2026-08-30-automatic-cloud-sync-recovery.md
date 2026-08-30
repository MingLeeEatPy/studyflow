# Automatic Cloud Sync Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a signed-in StudyFlow device restore and synchronize cloud data automatically, ask for a merge only once when both sides contain real user data, remove phone support, and report sync failures accurately.

**Architecture:** Introduce a user-scoped sync lifecycle marker and user-scoped cursor/snapshot keys. A bootstrap function classifies local data as generated defaults or meaningful user data, then automatically downloads a non-empty cloud snapshot onto an empty device, uploads a populated device to an empty cloud, or returns a merge decision only when both sides contain meaningful independent data. The app invokes bootstrap after session restoration and runs incremental sync on online, focus, visibility, and timer events.

**Tech Stack:** React 19, TypeScript, Dexie/IndexedDB, Supabase JS, Vitest, Vite PWA.

## Global Constraints

- Do not delete StudyFlow history, tasks, Garden records, meditation records, or reviews.
- Phone number authentication and recovery are not part of the product.
- A device must sign in once with the same email account before it can synchronize automatically.
- Generated default categories and default execution settings do not count as user data.
- Only `navigator.onLine === false` may produce the `offline` status; server and database failures produce `error` with their original message.

---

### Task 1: User-scoped sync bootstrap

**Files:**
- Modify: `src/features/syncService.ts`
- Test: `tests/sync-lifecycle.test.ts`

**Interfaces:**
- Produces: `initializeCloudSync(): Promise<SyncInitialization>`.
- Produces: `SyncInitialization` containing `result` and optional `mergeSummary`.
- Consumes: `pullSyncChanges`, `normalizeRemoteEntities`, `applyRemoteEntity`, and the current authenticated user id.

- [x] **Step 1: Write failing lifecycle tests**

```ts
expect(classifyLocalData(defaultOnlyBackup)).toBe("empty");
expect(scopedSyncKey("cursor", "user-a")).not.toBe(scopedSyncKey("cursor", "user-b"));
```

- [x] **Step 2: Run the focused test**

Run: `npm.cmd test -- --run tests/sync-lifecycle.test.ts`
Expected: FAIL because the lifecycle helpers do not exist.

- [x] **Step 3: Implement bootstrap and persistent completion marker**

```ts
export type SyncInitialization = { result: SyncResult; mergeSummary: MergeSummary | null };
export async function initializeCloudSync(): Promise<SyncInitialization>;
```

The implementation must automatically apply cloud data when local data contains only defaults, automatically upload when the cloud is empty, and return a merge summary only when both sides contain meaningful data and no completion marker exists.

- [x] **Step 4: Verify focused tests pass**

Run: `npm.cmd test -- --run tests/sync-lifecycle.test.ts`
Expected: PASS.

### Task 2: Automatic app synchronization and settings UI

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/pages/ExecutionSettingsPage.tsx`

**Interfaces:**
- Consumes: `initializeCloudSync()` after auth restoration.
- Consumes: `syncNow()` for already initialized devices.

- [x] **Step 1: Replace unconditional login-time `syncNow()` with bootstrap**

```ts
const initialize = async () => {
  const state = await initializeCloudSync();
  if (state.result.downloaded > 0) await refresh();
};
```

- [x] **Step 2: Add automatic retry triggers**

Run incremental synchronization every 30 seconds while signed in, when the browser comes online, when the window gains focus, and when a hidden page becomes visible.

- [x] **Step 3: Update the settings panel**

Display the merge choice only when bootstrap returns `mergeSummary`; otherwise show the signed-in state, last result, and manual sync fallback. Keep a failed merge retryable and never use `offline` as a loading state.

- [x] **Step 4: Run UI type checking**

Run: `npm.cmd run typecheck`
Expected: PASS.

### Task 3: Remove phone authentication completely

**Files:**
- Modify: `src/features/authAdapter.ts`
- Modify: `src/styles/global.css`
- Modify: `docs/AUTH_SETUP.md`
- Modify: `docs/SYNC_SETUP.md`
- Test: `tests/auth-adapter.test.ts`

**Interfaces:**
- `AuthUser` contains only `id`, `email`, and `provider`.
- `authAdapter` exposes no phone OTP methods.

- [x] **Step 1: Add an API-surface regression assertion**

```ts
expect("sendPhoneOtp" in authAdapter).toBe(false);
expect("verifyPhoneOtp" in authAdapter).toBe(false);
```

- [x] **Step 2: Delete phone fields, methods, copy, and styles**

Remove `phone`, `sendPhoneOtp`, `verifyPhoneOtp`, SMS-specific errors, and phone setup documentation.

- [x] **Step 3: Run authentication tests**

Run: `npm.cmd test -- --run tests/auth-adapter.test.ts`
Expected: PASS.

### Task 4: Regression and production verification

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Consumes all interfaces produced above.

- [x] **Step 1: Run sync and auth tests**

Run: `npm.cmd test -- --run tests/sync-merge.test.ts tests/sync-lifecycle.test.ts tests/auth-adapter.test.ts`
Expected: PASS.

- [x] **Step 2: Run all automated checks**

Run: `npm.cmd test`
Expected: all test files pass.

- [x] **Step 3: Run static checks and production build**

Run: `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
Expected: PASS and a generated PWA service worker in `dist`.

- [ ] **Step 4: Commit one coherent repair**

```bash
git add src tests docs
git commit -m "fix: automate resilient cloud synchronization"
```

## Self-Review

- Automatic restore, automatic incremental sync, one-time merge choice, phone removal, accurate offline/error states, and PWA persistence are covered.
- All public function names and result types are defined above.
- No SMS provider, password recovery, database deletion, or unrelated product work is introduced.
