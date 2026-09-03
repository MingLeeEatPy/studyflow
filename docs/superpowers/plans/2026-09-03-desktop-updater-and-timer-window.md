# Desktop Updater and Timer Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the installed Windows StudyFlow app securely discover, download, install, and restart into future versions, while ensuring the compact timer opens only on explicit minimize and can be moved reliably.

**Architecture:** Use Tauri v2’s signed updater with a static HTTPS `latest.json` hosted under the existing StudyFlow Cloudflare Pages domain. The desktop app checks that endpoint after startup and on a user-initiated “检查桌面版更新” action; it downloads only a Tauri-signed NSIS updater archive and lets the standard NSIS installer replace the installed app. The compact window remains an on-demand Tauri webview: Rust hides it during startup, and its whole dedicated top bar is a Tauri native drag region.

**Tech Stack:** Tauri 2.11, `tauri-plugin-updater` 2.x, `@tauri-apps/plugin-updater` 2.x, `@tauri-apps/plugin-process` 2.x, React 19, TypeScript, Vitest, NSIS, Cloudflare Pages static assets.

## Global Constraints

- The update endpoint and every update archive must use HTTPS.
- The updater public key is committed in `src-tauri/tauri.conf.json`; its private key is never committed, copied into chat, or uploaded to Cloudflare Pages.
- The update signing key must be backed up in the user’s password manager and an offline encrypted copy before the first public updater build; losing it prevents updates for already-installed clients.
- Windows code-signing certificates are not required for functional Tauri updates, but unsigned first-time installers can still trigger Microsoft SmartScreen.
- Auto-update must preserve local IndexedDB data and Supabase session data by updating the installed application in place rather than replacing the executable manually.
- No phone, SMTP, Supabase, task, timer, or PWA behavior changes are in scope.
- The timer window must never be shown at application launch; it is shown only by `compactToDesktop` after an active study or meditation session has been minimized.

---

## File Structure

- `src-tauri/Cargo.toml` — adds the Rust updater plugin dependency for desktop targets.
- `package.json` and `package-lock.json` — add the updater and process JavaScript bindings.
- `src-tauri/src/lib.rs` — registers the updater plugin and preserves on-demand timer-window lifecycle.
- `src-tauri/tauri.conf.json` — defines one updater endpoint, updater public key, passive Windows installer mode, updater artifacts, and NSIS packaging.
- `src-tauri/capabilities/desktop.json` — grants the main window updater check/download/install permissions and process relaunch permission.
- `src/desktop/desktopUpdater.ts` — isolates browser-safe desktop updater state, checking, download progress, installation, and relaunch.
- `src/components/DesktopUpdateCard.tsx` — renders the optional update state and explicit install/restart action without impacting the web PWA.
- `src/app/App.tsx` — mounts the desktop-only update card and starts one non-blocking update check.
- `tests/desktop-updater.test.ts` — verifies browser fallback and state transitions using a mocked updater adapter.
- `tests/desktop-bridge.test.ts` — verifies that normal web/PWA builds do not load desktop updater APIs.
- `src/desktop/DesktopTimerApp.tsx`, `src/desktop/desktopTimer.css`, and `src-tauri/src/lib.rs` — regression coverage and behavior for the compact timer opening/dragging.
- `docs/desktop-release.md` — repeatable private-key-safe release instructions and the exact Cloudflare Pages files to publish for each version.

## Release Contract

The desktop app reads exactly this static JSON URL after installation:

```text
https://<StudyFlow Cloudflare Pages production domain>/desktop/latest.json
```

The published JSON contains one Windows x64 updater artifact:

```json
{
  "version": "0.4.1",
  "notes": "修复桌面小窗口的启动与拖动交互。",
  "pub_date": "2026-09-03T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://<StudyFlow Cloudflare Pages production domain>/desktop/StudyFlow_0.4.1_x64-setup.nsis.zip",
      "signature": "CONTENTS_OF_THE_MATCHING_SIG_FILE"
    }
  }
}
```

The updater bundle URL is a versioned immutable filename. `latest.json` is the only mutable file. A cache-control rule of `no-store` applies to `desktop/latest.json`; immutable versioned archives receive `public, max-age=31536000, immutable`.

## Task 1: Add the signed Tauri updater foundation

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/desktop.json`
- Test: `tests/desktop-bridge.test.ts`

**Interfaces:**
- Consumes: Tauri updater plugin `check`, `downloadAndInstall`, and process plugin `relaunch`.
- Produces: a desktop build able to validate signed update manifests at the configured HTTPS endpoint.

- [ ] **Step 1: Add a failing browser-safety test**

Add this test to `tests/desktop-bridge.test.ts`:

```ts
import { isStudyFlowDesktop } from "../src/desktop/desktopBridge";

it("does not treat a normal browser as a desktop updater host", () => {
  expect(isStudyFlowDesktop()).toBe(false);
});
```

- [ ] **Step 2: Run the test to establish the existing browser guard**

Run: `npm.cmd test -- tests/desktop-bridge.test.ts`

Expected: PASS. The test proves updater code can be gated behind the same desktop-only detection as the timer bridge.

- [ ] **Step 3: Install and register official updater dependencies**

Run:

```powershell
npm.cmd install @tauri-apps/plugin-updater@^2.11.0 @tauri-apps/plugin-process@^2.11.0
$studyflowCargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
$env:Path = "$studyflowCargoBin;$env:Path"
Set-Location src-tauri
cargo add tauri-plugin-updater --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
Set-Location ..
```

In `src-tauri/src/lib.rs`, add this plugin beside the existing desktop plugins:

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

Add the updater permissions only to `src-tauri/capabilities/desktop.json`:

```json
"updater:default",
"process:allow-restart"
```

- [ ] **Step 4: Configure updater artifacts without committing a secret**

Generate a private key outside the repository once:

```powershell
npm.cmd exec tauri signer generate -- -w "$env:USERPROFILE\.tauri\studyflow-updater.key"
```

Store the command’s public-key output in `src-tauri/tauri.conf.json`; do not store the private key or its password there. Set this configuration, replacing only the public key and the already-known production Pages hostname:

```json
"bundle": {
  "active": true,
  "targets": "nsis",
  "createUpdaterArtifacts": true
},
"plugins": {
  "updater": {
    "pubkey": "PASTE_THE_GENERATED_PUBLIC_KEY_HERE",
    "endpoints": [
      "https://<StudyFlow Cloudflare Pages production domain>/desktop/latest.json"
    ],
    "windows": { "installMode": "passive" }
  }
}
```

- [ ] **Step 5: Verify the signed build contract**

Set the private key only for the current PowerShell session, then build:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\studyflow-updater.key"
npm.cmd run desktop:build
```

Expected: `src-tauri/target/release/bundle/nsis/` contains an NSIS setup executable, a `.nsis.zip` updater bundle, and the matching `.nsis.zip.sig` signature.

- [ ] **Step 6: Commit the safe foundation only**

```powershell
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/desktop.json tests/desktop-bridge.test.ts
git commit -m "feat: configure signed desktop updates"
```

## Task 2: Add a desktop-only update controller and user interface

**Files:**
- Create: `src/desktop/desktopUpdater.ts`
- Create: `src/components/DesktopUpdateCard.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/desktop-updater.test.ts`

**Interfaces:**
- Consumes: `isStudyFlowDesktop()` and the official updater APIs.
- Produces:

```ts
export type DesktopUpdateState =
  | { status: "idle" | "checking" | "up-to-date" | "unsupported" }
  | { status: "available"; version: string; notes: string | null }
  | { status: "downloading"; percent: number | null }
  | { status: "failed"; message: string };

export interface DesktopUpdater {
  check(): Promise<DesktopUpdateState>;
  install(): Promise<void>;
}
```

- [ ] **Step 1: Write failing controller tests**

Create `tests/desktop-updater.test.ts` with a fake adapter test:

```ts
it("reports an available update before installation", async () => {
  const updater = createDesktopUpdater({
    isDesktop: () => true,
    checkForUpdate: async () => ({ version: "0.4.2", body: "修复计时器", downloadAndInstall: async () => undefined }),
    relaunch: async () => undefined,
  });
  await expect(updater.check()).resolves.toMatchObject({ status: "available", version: "0.4.2" });
});

it("does not import native APIs in a browser", async () => {
  const updater = createDesktopUpdater({ isDesktop: () => false });
  await expect(updater.check()).resolves.toEqual({ status: "unsupported" });
});
```

- [ ] **Step 2: Run the controller tests and verify they fail**

Run: `npm.cmd test -- tests/desktop-updater.test.ts`

Expected: FAIL because `createDesktopUpdater` does not exist.

- [ ] **Step 3: Implement the minimal controller**

Create `src/desktop/desktopUpdater.ts`. It must lazily `import("@tauri-apps/plugin-updater")` and `import("@tauri-apps/plugin-process")` only after `isStudyFlowDesktop()` returns true. Save the returned update object only in module memory; `install()` calls `downloadAndInstall`, tracks `Started`, `Progress`, and `Finished`, then calls `relaunch()`. Convert thrown errors to a short Chinese `failed` message and never affect timer or sync state.

- [ ] **Step 4: Implement the update card**

Create `src/components/DesktopUpdateCard.tsx` with this exact interaction:

```tsx
export function DesktopUpdateCard({ state, onCheck, onInstall }: Props) {
  if (state.status === "unsupported") return null;
  if (state.status === "available") {
    return <section aria-label="桌面版更新"><strong>发现 StudyFlow {state.version}</strong><button onClick={onInstall}>下载并重启</button></section>;
  }
  return <section aria-label="桌面版更新"><button disabled={state.status === "checking" || state.status === "downloading"} onClick={onCheck}>检查桌面版更新</button></section>;
}
```

Mount it in the Settings page area rendered by `src/app/App.tsx`, not the PWA update prompt. On desktop startup call `check()` once after the application data finishes loading; the card must not interrupt an active focus session.

- [ ] **Step 5: Run all frontend checks**

Run:

```powershell
npm.cmd test -- tests/desktop-updater.test.ts tests/desktop-bridge.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Commit the user-facing updater**

```powershell
git add src/desktop/desktopUpdater.ts src/components/DesktopUpdateCard.tsx src/app/App.tsx tests/desktop-updater.test.ts
git commit -m "feat: add desktop update controls"
```

## Task 3: Repair the compact timer show path and dragging regression

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/desktop/desktopBridge.ts`
- Modify: `src/desktop/DesktopTimerApp.tsx`
- Modify: `src/desktop/desktopTimer.css`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/desktop-bridge.test.ts`

**Interfaces:**
- Consumes: `desktopBridge.showTimer()`, `desktopBridge.hideMain()`, and the active study/meditation session state.
- Produces: `compactToDesktop()` that either completes both native window operations or reports an error and leaves the main window visible.

- [ ] **Step 1: Write a failing bridge test for ordered window commands**

Add a test that injects a fake invoke implementation and asserts `reveal_studyflow_window` is called before `hide_studyflow_window` when compacting. The fake must reject `reveal_studyflow_window` and assert that `hide_studyflow_window` is not called after the rejection.

- [ ] **Step 2: Run the bridge test to verify the missing error boundary**

Run: `npm.cmd test -- tests/desktop-bridge.test.ts`

Expected: FAIL before `compactToDesktop` catches a failed timer reveal.

- [ ] **Step 3: Make native show reliable before main hide**

In `src/app/App.tsx`, use this control flow:

```ts
async function compactToDesktop() {
  if (desktopBridge.isAvailable()) {
    try {
      await desktopBridge.showTimer();
      await desktopBridge.hideMain();
    } catch (error) {
      setDesktopWindowError("无法打开小计时器，请保持主窗口开启后重试。");
    }
    return;
  }
  updateCompactPreference({ ...compactPreference, enabled: true });
  setPage(lastPage);
}
```

In Rust, make `reveal_studyflow_window` call `unminimize`, `show`, and `set_focus`; return the first error instead of swallowing it. Do not let `window-state` override the explicit startup timer hide.

- [ ] **Step 4: Make the title area a native drag region**

Use a non-button title bar in `src/desktop/DesktopTimerApp.tsx`:

```tsx
<div className="desktop-timer-titlebar" data-tauri-drag-region onMouseDown={() => void desktopBridge.startDragging()}>
  StudyFlow
</div>
```

The CSS must reserve a 28px first grid row and set `cursor: grab`, `user-select: none`, and `-webkit-user-select: none` for `.desktop-timer-titlebar`. Keep all lower timer actions clickable and outside the drag region.

- [ ] **Step 5: Verify Windows build and manual behavior**

Run:

```powershell
npm.cmd test -- tests/desktop-bridge.test.ts
npm.cmd run typecheck
npm.cmd run lint
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\studyflow-updater.key"
npm.cmd run desktop:build
```

Manual acceptance:

1. Fully exit StudyFlow and start it: only the main window appears.
2. Start a focus or meditation session and click “缩小计时器”: the timer window appears before the main window hides.
3. Drag the `StudyFlow` strip on the timer: its desktop position changes.
4. Click expand: main Focus/Meditation view reappears and timer window hides.

- [ ] **Step 6: Commit the timer repair**

```powershell
git add src/app/App.tsx src/desktop/desktopBridge.ts src/desktop/DesktopTimerApp.tsx src/desktop/desktopTimer.css src-tauri/src/lib.rs tests/desktop-bridge.test.ts
git commit -m "fix: restore on-demand desktop timer window"
```

## Task 4: Publish the first updater-enabled desktop release

**Files:**
- Create: `docs/desktop-release.md`
- Create at deploy time: `public/desktop/latest.json`
- Create at deploy time: `public/desktop/StudyFlow_<version>_x64-setup.nsis.zip`

**Interfaces:**
- Consumes: NSIS `.nsis.zip` and `.nsis.zip.sig` output plus the private signing key.
- Produces: a valid static JSON manifest and immutable update bundle reachable from Cloudflare Pages.

- [ ] **Step 1: Write release documentation**

Document these exact release commands in `docs/desktop-release.md`:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\studyflow-updater.key"
npm.cmd run desktop:build
Get-ChildItem src-tauri\target\release\bundle\nsis\* -Include *.exe,*.zip,*.sig
```

The documentation must say to increment both `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` to the identical next SemVer version before each release.

- [ ] **Step 2: Publish release assets to the production Pages project**

Copy the generated `StudyFlow_<version>_x64-setup.nsis.zip` to `public/desktop/`. Create `public/desktop/latest.json` from the matching `.sig` file content, with the matching version and archive URL. Commit both release files and let the existing Cloudflare Pages GitHub deployment publish them.

Do not place the private key, its password, a plaintext bearer token, or an `.env` file under `public/`, Git, or Cloudflare Pages.

- [ ] **Step 3: Verify the endpoint before testing an update**

Run:

```powershell
Invoke-WebRequest https://<StudyFlow Cloudflare Pages production domain>/desktop/latest.json | Select-Object -ExpandProperty Content
```

Expected: HTTP 200 and one valid JSON object whose `signature` value exactly equals the contents of the matching generated `.sig` file.

- [ ] **Step 4: Run an end-to-end update test from an older installed version**

Install the prior NSIS release (not a standalone `studyflow.exe`). Start it, open Settings, click “检查桌面版更新,” then “下载并重启.” Expected: Windows exits StudyFlow during installation, NSIS shows passive progress, StudyFlow restarts at the newer version, and existing local tasks/history are still present.

- [ ] **Step 5: Commit documentation and release metadata**

```powershell
git add docs/desktop-release.md public/desktop/latest.json public/desktop/StudyFlow_<version>_x64-setup.nsis.zip
git commit -m "chore: publish StudyFlow desktop update <version>"
```

## Self-Review

- Spec coverage: Task 1 adds cryptographic updater setup and signed artifacts; Task 2 gives users a non-disruptive update path; Task 3 fixes the requested compact-timer regression; Task 4 hosts the release contract on the existing HTTPS deployment.
- No placeholder scan: strings in angle brackets identify the only environment-specific value (the existing Cloudflare production hostname) and are intentionally replaced once, not guessed. The private signing key is deliberately excluded from code and documentation values.
- Type consistency: `DesktopUpdateState`, `DesktopUpdater.check`, and `DesktopUpdater.install` are defined in Task 2 and consumed only by the update card. Native timer operations remain in `desktopBridge` and are ordered in Task 3.

## External One-Time Inputs

1. The exact existing Cloudflare Pages production hostname, which is the public update endpoint and archive host.
2. Permission to generate a local Tauri updater signing key. This is not a Cloudflare or Supabase secret; it must remain on the owner’s computer and be backed up.
3. For the first release only, upload/update the Pages release assets if GitHub deployment remains unavailable. Subsequent releases can use the documented static asset path.
