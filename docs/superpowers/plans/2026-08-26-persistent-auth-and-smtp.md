# StudyFlow 持久登录与 SMTP 计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用稳定的邮箱+密码登录替代默认 Magic Link 主流程，让用户在电脑和手机上分别登录一次后自动保持会话并完成云端同步；SMTP 仅用于验证邮箱、找回密码和生产邮件投递。

**Architecture:** 使用 Supabase Auth 的 `signUp`、`signInWithPassword`、`resetPasswordForEmail` 和持久 session。前端优先使用官方 Supabase JS client，避免当前手写 REST 回调对 QQ 内置浏览器、Chrome 和 PWA 的依赖。IndexedDB 继续作为离线数据层，登录成功后自动触发备份合并和同步；“立即同步”只保留在设置页作为手动故障排查入口。

**Tech Stack:** React + TypeScript + Vite、`@supabase/supabase-js`、Supabase Auth/Postgres/RLS、Dexie/IndexedDB、Vitest、Playwright、Cloudflare Pages/Workers。

## Global Constraints

- Magic Link 不再作为默认登录方式；可以保留为备用入口，但主按钮必须是邮箱+密码登录。
- 不删除已有 Supabase 用户、IndexedDB 数据、任务、会话、Growth Garden 或备份。
- 登录状态必须持久化到设备；刷新页面、关闭浏览器、重新打开 PWA 后仍保持登录，除非用户主动退出。
- 首次在一台设备登录时自动显示本地/云端摘要，只询问一次合并策略；后续不要求用户手动导出或点击同步。
- SMTP 凭证只进入 Supabase Dashboard，不进入 GitHub、Cloudflare 前端变量或聊天记录。
- Publishable/anon key 可以进入前端构建；Secret/service_role key 永远不能进入前端。

---

### Task 1: 认证客户端和会话适配

**Files:**
- Modify: `package.json`（添加 `@supabase/supabase-js`）
- Modify: `src/features/supabaseClient.ts`
- Replace: `src/features/authAdapter.ts`
- Test: `tests/auth-adapter.test.ts`

**Interfaces:**
- `authAdapter.getSession(): Promise<AuthSession | null>`
- `authAdapter.signUp(email, password): Promise<AuthResult>`
- `authAdapter.signIn(email, password): Promise<AuthResult>`
- `authAdapter.sendPasswordReset(email): Promise<void>`
- `authAdapter.signOut(): Promise<void>`
- `authAdapter.onAuthStateChange(listener): () => void`

- [ ] **Step 1: Write failing tests** for sign-up validation, password sign-in, session restoration after reload, sign-out, and missing configuration.
- [ ] **Step 2: Install** `@supabase/supabase-js` and create one browser client with `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: false`.
- [ ] **Step 3: Implement** the adapter using official Auth APIs; map Supabase errors into clear Chinese messages such as“邮箱或密码不正确”“该邮箱已注册”“密码至少 8 位”。
- [ ] **Step 4: Remove** manual hash/token parsing and localStorage access-token code; let the Supabase client own session refresh and storage.
- [ ] **Step 5: Run** `npm.cmd test -- tests/auth-adapter.test.ts` and `npm.cmd run typecheck`.

### Task 2: 登录界面和账号状态

**Files:**
- Modify: `src/pages/ExecutionSettingsPage.tsx`
- Create: `src/components/AuthPanel.tsx`
- Modify: `src/styles/global.css`
- Test: `tests/auth-panel.test.tsx`

**Interfaces:**
- `AuthPanel` receives `onAuthenticated(user)` and displays `sign-in`, `sign-up`, `forgot-password`, and `signed-in` states.

- [ ] **Step 1: Write failing UI tests** for login, registration, password reset request, validation messages, and persistent signed-in state.
- [ ] **Step 2: Replace** the current Magic Link form with tabs or a single mode switch: `登录` / `注册` / `找回密码`.
- [ ] **Step 3: Add** password visibility toggle, disabled/loading states, and “保持登录” behavior delegated to Supabase persistent session.
- [ ] **Step 4: Keep** a small “使用邮箱链接登录” secondary option only if product still wants a passwordless fallback; it must not be the primary path.
- [ ] **Step 5: Run** UI tests, typecheck and lint.

### Task 3: 自动首次合并和后台同步

**Files:**
- Modify: `src/features/syncService.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/components/AuthPanel.tsx`
- Test: `tests/sync-service.test.ts`

- [ ] **Step 1: Write failing tests** for first-device local upload, second-device cloud pull, cancellation without mutation, and repeated login without showing the merge prompt again.
- [ ] **Step 2: On `SIGNED_IN`**, create a local backup silently, calculate local/cloud counts, and show one confirmation dialog only when local or cloud data exists.
- [ ] **Step 3: On “合并”**, upload local entities and pull remote entities using the existing timestamp/append-only rules; refresh Today, History and Garden automatically.
- [ ] **Step 4: On subsequent app startup, online events, and auth refresh**, call sync in the background; keep manual “立即同步” only as a secondary settings action.
- [ ] **Step 5: Add** clear states: `正在登录`, `首次合并`, `已同步`, `离线待同步`, `同步失败`.
- [ ] **Step 6: Run** all sync tests and existing unit tests.

### Task 4: Supabase Auth configuration and migration compatibility

**Files:**
- Create: `docs/AUTH_SETUP.md`
- Modify: `docs/SYNC_SETUP.md`
- Test: `tests/auth-migration.test.ts`

- [ ] **Step 1: Document** enabling Email provider, whether email confirmation is required, password minimum length, Site URL, and HTTPS redirect URL.
- [ ] **Step 2: Document** that existing Magic Link-created users can set a password through “设置密码/找回密码”; no user data is deleted.
- [ ] **Step 3: Add** a safe “forgot password” flow and redirect page; reset tokens are consumed only by Supabase Auth.
- [ ] **Step 4: Test** old session expiration, new password sign-in, logout/login on two devices, and no-data-loss behavior.

### Task 5: SMTP setup for production email

**Files:**
- Modify: `docs/AUTH_SETUP.md`
- No SMTP credentials committed to the repository.

- [ ] **Step 1: Choose** a transactional SMTP provider with a verified sender domain; for small tests, use its SMTP credentials rather than the provider API key.
- [ ] **Step 2: In Supabase open** `Authentication → Emails → SMTP Settings` and enter host, port, username, password, sender name and sender email.
- [ ] **Step 3: Send** a test password-reset email and confirm delivery to QQ and Gmail; check spam and link domains.
- [ ] **Step 4: Keep** Auth rate limits appropriate for the first cohort; do not expose SMTP credentials to Cloudflare or the browser.
- [ ] **Step 5: Document** sender-domain verification, rate limits, and how to rotate SMTP credentials.

### Task 6: Two-device E2E and rollout

**Files:**
- Create: `e2e/auth-sync.spec.ts`
- Modify: `e2e/pwa.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Test** register → sign in → local merge → second browser sign in → cloud pull.
- [ ] **Step 2: Test** refresh/close/reopen persistence, logout, wrong password, password reset, offline mutation, and recovery.
- [ ] **Step 3: Test** the production HTTPS origin rather than localhost for the PWA path.
- [ ] **Step 4: Run** `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, and relevant Playwright specs.
- [ ] **Step 5: Deploy** Cloudflare only after local and production HTTPS auth tests pass; keep Garden and current sync changes in the same final release if desired.

## Decision

SMTP alone is not the simpler login solution: it improves email delivery and removes the built-in 429 quota, but Magic Link would still require cross-browser callback handling. The recommended first implementation is persistent email/password login, with SMTP configured afterward for password reset and verification emails. Google OAuth can be considered later, but it requires Google Cloud OAuth credentials and adds another external setup dependency.
