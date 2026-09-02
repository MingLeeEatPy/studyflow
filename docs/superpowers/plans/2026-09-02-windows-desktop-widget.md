# StudyFlow Windows Desktop Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Windows desktop edition of StudyFlow with an independent, always-on-top focus card that continues running while the main window is hidden to the system tray.

**Architecture:** Keep the existing React application and Supabase synchronization logic intact. Add a Tauri 2 Windows shell with two top-level windows: `main` renders the full app and `timer` renders a dedicated compact route. Rust owns the tray lifecycle and native Windows notifications; the web UI owns the visible timer state, derived from persisted interval timestamps rather than background JavaScript ticks.

**Tech Stack:** React 19, Vite, TypeScript, Tauri 2, Rust, WebView2, tauri-plugin-notification, tauri-plugin-window-state.

## Global Constraints

- Windows-only for this release; do not change the Cloudflare PWA behavior.
- Reuse existing IndexedDB, Supabase login, sync entities, and timer interval data.
- The widget must be a top-level window, never a child/owned window, because Windows hides owned windows when their owner is minimized.
- The widget must stay visible when the main window hides to the tray and must be closable only through its explicit collapse control or the tray menu.
- Actual elapsed time is computed from interval timestamps on every render, resume, and native event; never stored as incremented counters.
- No phone, SMTP, payment, Microsoft Store, code-signing, or app-blocking features are added in this release.

---

### Task 1: Add the Tauri desktop target

**Files:**
- Modify: `package.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`

**Interfaces:**
- Produces `npm run tauri:dev` and `npm run tauri:build`.
- Produces the Rust command `show_main_window` callable from the web UI.

- [ ] **Step 1: Add a failing desktop command check**

Run: `npm.cmd run tauri:dev`

Expected: fails because `@tauri-apps/cli` and `src-tauri` are absent.

- [ ] **Step 2: Add the JavaScript commands**

Add to `package.json`:

```json
"tauri": "tauri",
"tauri:dev": "tauri dev",
"tauri:build": "tauri build"
```

- [ ] **Step 3: Create the Tauri configuration**

Configure `main` as a normal 1280×820 window and `timer` as a hidden, undecorated 300×116 window with `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`, and URL `/#desktop-timer`. Do not set `parent` for `timer`.

- [ ] **Step 4: Implement the native shell**

Register notification and window-state plugins. Create a tray menu with `显示 StudyFlow`, `显示/隐藏计时卡片`, and `退出 StudyFlow`. Intercept main-window close to hide it instead of exiting; tray `退出 StudyFlow` performs the actual exit.

- [ ] **Step 5: Grant minimum window/tray/notification capabilities**

Allow only show, hide, close, set-always-on-top, start-dragging, and notification permissions needed by the two StudyFlow windows.

- [ ] **Step 6: Verify development startup**

Run: `npm.cmd run tauri:dev`

Expected: the full StudyFlow window opens and closing it hides it to the tray.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json src-tauri
git commit -m "feat: add Windows Tauri shell"
```

### Task 2: Add a desktop-only platform bridge

**Files:**
- Create: `src/features/desktopBridge.ts`
- Test: `tests/desktop-bridge.test.ts`

**Interfaces:**
- Produces `desktopBridge.isDesktop(): boolean`.
- Produces `desktopBridge.showTimer(): Promise<void>`, `hideTimer(): Promise<void>`, `showMain(): Promise<void>`, and `notify(title: string, body: string): Promise<void>`.

- [ ] **Step 1: Write failing tests**

```ts
expect(desktopBridge.isDesktop()).toBe(false);
await expect(desktopBridge.showTimer()).resolves.toBeUndefined();
```

- [ ] **Step 2: Implement browser-safe no-op behavior**

Detect `window.__TAURI_INTERNALS__`; only dynamically import `@tauri-apps/api` when it exists. In browsers, all methods resolve without changing PWA behavior.

- [ ] **Step 3: Implement desktop commands**

Use `WebviewWindow.getByLabel("timer")` and `getCurrentWindow()` to show/hide/focus windows. Use the native notification plugin only in Tauri; retain current browser notification behavior outside Tauri.

- [ ] **Step 4: Verify tests**

Run: `npm.cmd test -- tests/desktop-bridge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/desktopBridge.ts tests/desktop-bridge.test.ts
git commit -m "feat: add browser-safe desktop bridge"
```

### Task 3: Render the independent timer card

**Files:**
- Create: `src/pages/DesktopTimerPage.tsx`
- Create: `src/styles/desktopTimer.css`
- Modify: `src/app/App.tsx`
- Modify: `src/components/CompactTimerWidget.tsx`
- Test: `tests/desktop-timer.test.tsx`

**Interfaces:**
- `DesktopTimerPage` consumes the existing active study/meditation session and interval data.
- It exposes pause/resume, finish, open main app, and hide-card actions.

- [ ] **Step 1: Write a failing widget test**

```tsx
render(<DesktopTimerPage active={runningStudy} ... />);
expect(screen.getByRole("complementary", { name: "StudyFlow 桌面计时卡片" })).toBeVisible();
expect(screen.getByText("01:05")).toBeVisible();
```

- [ ] **Step 2: Add the desktop route**

When the URL hash is `#desktop-timer`, render only the card; do not render the sidebar, PWA update prompt, or normal application shell. If no active session exists, show an empty card with `打开 StudyFlow` and call `desktopBridge.showMain()`.

- [ ] **Step 3: Implement card controls**

Use the same `executionAdapter` and `meditationAdapter` actions as Focus. The drag area calls `getCurrentWindow().startDragging()` only in Tauri. `打开完整界面` calls `showMain`; `隐藏卡片` calls `hideTimer`; finish opens the existing finish modal in the main window rather than duplicating the form.

- [ ] **Step 4: Synchronize the two windows**

Retain `BroadcastChannel("studyflow-execution")` for same-origin browser windows and add a Tauri window event refresh listener. On start, pause, resume, completion, correction, and finish, broadcast a refresh to both labels.

- [ ] **Step 5: Verify focused tests**

Run: `npm.cmd test -- tests/desktop-timer.test.tsx tests/compact-timer.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/pages/DesktopTimerPage.tsx src/styles/desktopTimer.css src/app/App.tsx src/components/CompactTimerWidget.tsx tests/desktop-timer.test.tsx
git commit -m "feat: add independent Windows timer card"
```

### Task 4: Connect lifecycle, tray, and native reminders

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/features/reminderService.ts`
- Modify: `src-tauri/src/main.rs`
- Test: `tests/timer-lifecycle.test.ts`

**Interfaces:**
- `desktopBridge.showTimer()` is called when a study or meditation session starts or resumes.
- `desktopBridge.hideTimer()` is called only when the active session ends or the user explicitly hides it.

- [ ] **Step 1: Write lifecycle tests**

```ts
expect(deriveStudyDeadline(runningSession, interval, resumedAt)?.dueAt).toBe(expectedDueAt);
expect(isVisibleClockJump(hiddenSample)).toBe(false);
```

- [ ] **Step 2: Show and refresh the card for active sessions**

On desktop start/resume, show the `timer` window and emit a refresh. On app initialization, show it when an active session exists. On session finish/discard, hide it.

- [ ] **Step 3: Use native notification fallback**

At focus, break, and meditation boundaries, call the existing sound path and call `desktopBridge.notify("StudyFlow", genericMessage)`. Keep Web Push unchanged for PWA devices.

- [ ] **Step 4: Verify background behavior manually**

Start a one-minute pomodoro, hide the main window to the tray, wait past its deadline, then restore the main window. Expected: the card remains visible, state is at the correct boundary exactly once, and the history duration uses real elapsed time.

- [ ] **Step 5: Commit**

```powershell
git add src/app/App.tsx src/features/reminderService.ts src-tauri/src/main.rs tests/timer-lifecycle.test.ts
git commit -m "feat: keep Windows timer active from tray"
```

### Task 5: Build, package, and document Windows use

**Files:**
- Modify: `README.md`
- Create: `docs/WINDOWS_DESKTOP.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add user-facing instructions**

Document that the Windows desktop edition is separate from the browser PWA, uses the same account for cloud synchronization, places the app in the system tray on close, and should be exited through the tray menu. State that Windows SmartScreen may show an unsigned-app warning for private testing.

- [ ] **Step 2: Build the installer**

Run: `npm.cmd run tauri:build`

Expected: an NSIS installer and executable are generated in `src-tauri/target/release/bundle`.

- [ ] **Step 3: Run quality checks**

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Expected: all pass. Then manually validate desktop start, tray hide/show, independent timer card, pause/resume, finish, notification, restart, and cloud synchronization.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/WINDOWS_DESKTOP.md .gitignore
git commit -m "docs: add Windows desktop usage guide"
```

## Acceptance Criteria

- The timer card remains visible when the main StudyFlow window is minimized or hidden to the system tray.
- The card stays above other Windows applications, can be moved, and can open the full app.
- Pausing, resuming, and finishing from either window immediately updates the other.
- Returning after background time uses real timestamps and never auto-pauses a running stopwatch.
- Focus and meditation completion show a native Windows notification when desktop notifications are enabled.
- Browser PWA behavior, Cloudflare deployment, backup data, and cloud synchronization remain unchanged.
- `npm.cmd run tauri:build` produces an installable Windows bundle.

## Prerequisites

- Rust stable with the MSVC target.
- Visual Studio 2022 Build Tools with the Desktop development with C++ workload and Windows SDK.
- Microsoft Edge WebView2 Runtime; normally already present on Windows 10/11.
- These are free development dependencies. No Microsoft Store account or paid Tauri license is required for private installation.
