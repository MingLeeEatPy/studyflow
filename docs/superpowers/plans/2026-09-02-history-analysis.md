# Historical Workload Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give StudyFlow users a weekly or monthly comparison between planned category workload and real completed actions, with focus time retained as supporting evidence.

**Architecture:** Store a reusable weekly workload target list inside the existing `ExecutionSettings` record so it travels through the current IndexedDB migration, backup and cloud-sync path without a new server table. A pure analytics module derives period boundaries, planned shares, completed-task shares and focus-time shares from existing task/session data. A new page renders the comparison and lets users edit each category's weekly planned action count.

**Tech Stack:** React 19, TypeScript, Dexie/IndexedDB, Zod, Vitest, existing StudyFlow cloud sync.

## Global Constraints

- “计划行动量” is a count of independently completable actions, not estimated minutes.
- The expected distribution is computed from positive category action counts; a zero-count category is excluded from the planned share.
- Actual workload distribution is based on tasks whose `completedAt` falls inside the selected local calendar period.
- Focus minutes are informative only; they do not determine whether the plan was followed.
- Study sessions without a completed task remain visible only in the focus-time supplement.
- Do not include meditation in subject workload analysis.
- Existing settings, backups and cloud users must migrate without data loss.
- Preserve current History and Garden behaviour.

---

### Task 1: Persist weekly workload targets in existing settings

**Files:**
- Modify: `shared/schemas/models.ts`
- Modify: `src/db/database.ts`
- Modify: `tests/settings-v6-migration.test.ts`
- Modify: `tests/backup.test.ts`

**Interfaces:**
- Produces `WorkloadTarget { categoryId: string; plannedActions: number }`.
- Produces `ExecutionSettings.workloadTargets: WorkloadTarget[]`.
- Existing `settingsRepository.updateExecutionSettings` accepts `workloadTargets` through its existing partial settings input.

- [ ] **Step 1: Write a failing settings migration assertion**

```ts
expect(settings.workloadTargets).toEqual([]);
```

Add this assertion after opening a v6 database fixture that has no workload field.

- [ ] **Step 2: Run the focused migration test**

Run: `npm.cmd test -- tests/settings-v6-migration.test.ts`

Expected: FAIL because `workloadTargets` is missing.

- [ ] **Step 3: Add the Zod schema and database v7 migration**

```ts
export const workloadTargetSchema = z.object({
  categoryId: z.string().min(1),
  plannedActions: z.number().int().min(0).max(99),
});

// executionSettingsSchema
workloadTargets: z.array(workloadTargetSchema).default([]),

// defaultExecutionSettings
workloadTargets: [],

// database version 7 upgrade
await tx.table<ExecutionSettings, string>("executionSettings")
  .toCollection().modify((value) => { value.workloadTargets ??= []; });
```

- [ ] **Step 4: Add an old-backup compatibility assertion**

Extend the existing backup test to import a v5 backup and assert that its restored `executionSettings.workloadTargets` equals `[]`.

- [ ] **Step 5: Run focused tests**

Run: `npm.cmd test -- tests/settings-v6-migration.test.ts tests/backup.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add shared/schemas/models.ts src/db/database.ts tests/settings-v6-migration.test.ts tests/backup.test.ts
git commit -m "feat: persist workload allocation targets"
```

### Task 2: Build deterministic workload analytics domain functions

**Files:**
- Create: `src/domain/workloadAnalysis.ts`
- Create: `tests/workload-analysis.test.ts`

**Interfaces:**

```ts
export type AnalysisPeriod = "week" | "month";
export type DateRange = { from: string; to: string; label: string };
export type CategoryWorkload = {
  categoryId: string;
  plannedActions: number;
  plannedShare: number | null;
  completedActions: number;
  completedShare: number | null;
  focusSeconds: number;
  focusShare: number | null;
  deviationPoints: number | null;
};
export function analysisRange(period: AnalysisPeriod, anchor: string): DateRange;
export function buildCategoryWorkload(input: { categories: Category[]; tasks: Task[]; sessions: StudySession[]; intervalsBySession: Record<string, StudyInterval[]>; targets: WorkloadTarget[]; range: DateRange }): CategoryWorkload[];
```

- [ ] **Step 1: Write failing examples for a weekly range and a workload comparison**

```ts
expect(analysisRange("week", "2026-09-02")).toMatchObject({ from: "2026-08-31", to: "2026-09-06" });
expect(rows.find((row) => row.categoryId === "math")).toMatchObject({
  plannedShare: 0.6, completedShare: 0.5, deviationPoints: -10,
});
```

Use three completed fixture tasks and focus intervals with pauses to prove that only active focus seconds count.

- [ ] **Step 2: Run the domain test**

Run: `npm.cmd test -- tests/workload-analysis.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement local-period and aggregation logic**

```ts
const isWithinRange = (date: string, range: DateRange) => date >= range.from && date <= range.to;
const plannedTotal = rows.reduce((sum, row) => sum + row.plannedActions, 0);
const completedTotal = rows.reduce((sum, row) => sum + row.completedActions, 0);
const share = (value: number, total: number) => total > 0 ? value / total : null;
```

Use `completedAt` converted with the task/session timezone fallback to `Asia/Shanghai`; use `totalFocusMs` for each session interval group. Round only display values, not stored calculation values.

- [ ] **Step 4: Add no-target and no-completion cases**

Assert that a category with zero plan has `plannedShare: null`, and no completed tasks produces `completedShare: null` rather than a misleading `0%` comparison.

- [ ] **Step 5: Run focused tests**

Run: `npm.cmd test -- tests/workload-analysis.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/workloadAnalysis.ts tests/workload-analysis.test.ts
git commit -m "feat: derive workload distribution from history"
```

### Task 3: Add the Analysis page and workload-target editor

**Files:**
- Create: `src/pages/AnalysisPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/nature.css`
- Test: `tests/workload-analysis.test.ts`

**Interfaces:**
- `AnalysisPage` receives `categories`, `tasks`, `sessions`, `settings` and `onSaveTargets`.
- It loads session intervals through `executionAdapter.listIntervals` and renders a loading state until they are available.
- It calls `onSaveTargets(targets)` only when the user presses “保存计划行动量”.

- [ ] **Step 1: Write a component-level assertion for empty targets**

```tsx
render(<AnalysisPage categories={categories} tasks={[]} sessions={[]} settings={settings} onSaveTargets={vi.fn()} />);
expect(screen.getByText("先为每个科目填写本周计划行动量")).toBeInTheDocument();
```

- [ ] **Step 2: Run the test**

Run: `npm.cmd test -- tests/workload-analysis.test.ts`

Expected: FAIL because `AnalysisPage` does not exist.

- [ ] **Step 3: Implement the page with three restrained sections**

```tsx
<select aria-label="分析周期"><option value="week">本周</option><option value="month">本月</option></select>
<input aria-label={`${category.name} 计划行动量`} type="number" min="0" max="99" />
```

Render:

1. a period switcher and previous/next period controls;
2. a plan editor with one positive integer action count per active category;
3. a compact comparison table: planned share, completed actions/share, deviation in percentage points and focus time.

Use plain-language feedback only: “投入偏少，下一周期增加可完成行动” for a negative deviation below -15 points, “投入偏多，检查是否挤占其他科目” above +15, and “与计划接近” otherwise. Do not render decorative charts or ranking scores.

- [ ] **Step 4: Wire it into navigation and persistence**

Add the `analysis` page type and sidebar item in `App.tsx`. Pass `settings` and save with:

```ts
const next = await executionAdapter.saveSettings({ workloadTargets: targets });
setSettings(next);
channelRef.current?.postMessage("changed");
```

- [ ] **Step 5: Add responsive CSS**

Use an accessible table-like grid on wide windows and stacked cards below 720px. Preserve existing green/cream nature palette and ensure inputs remain plain functional controls.

- [ ] **Step 6: Run verification**

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: all existing tests plus workload tests pass; production build includes the Analysis page.

- [ ] **Step 7: Commit**

```powershell
git add src/pages/AnalysisPage.tsx src/app/App.tsx src/styles/nature.css tests/workload-analysis.test.ts
git commit -m "feat: add historical workload analysis"
```

## Self-Review

- Spec coverage: task 1 persists the plan through settings, backups and sync; task 2 calculates weekly/monthly planned versus actual distributions; task 3 presents the editor and actionable comparison without conflating time with workload.
- Placeholder scan: each task lists file paths, interfaces, test assertions and commands; no deferred implementation sections remain.
- Type consistency: `WorkloadTarget` is defined in task 1 and consumed by the calculation input in task 2 and the page save callback in task 3.
