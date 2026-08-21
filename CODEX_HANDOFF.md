# StudyFlow Codex Handoff

## Windows v3 completion update

PWA is enabled through `vite-plugin-pwa`: production builds emit `manifest.webmanifest` and `sw.js`; local verification works on `localhost`, and installation requires HTTPS after deployment. The service worker presents updates for explicit refresh and never silently reloads an active session.

The Windows workspace is now on v3 / package version 0.3.0. Unit tests, typecheck, lint, production build, and the existing Playwright flows have been run on Windows; Windows-specific visual snapshots are checked in. Do not add v4 features before dogfooding. Run commands with `npm.cmd` when PowerShell blocks `npm.ps1`.

## 交接日期与分支

- 交接环境：Ubuntu 22.04
- 交接分支：`feature/v3-meditation`
- 远端仓库：`https://github.com/MingLeeEatPy/studyflow.git`
- 目标：把 Ubuntu 中途停止的工作安全保存到 GitHub，随后在 Windows VS Code + Codex 继续。

## 本次开发新增内容

本地未提交工作包含 V3 Growth Garden + Meditation：

- IndexedDB schema version 3 与 V3 JSON backup。
- `GrowthRecord`、学习树、冥想花、Today 花园及稳定植物变体。
- `MeditationSession`、`MeditationInterval`、Meditation Repository 和页面。
- 定时/自由冥想、呼吸引导、暂停/恢复、到时后正计时、复盘、History 类型筛选。
- V3 单元测试、Playwright 测试和 Meditation 视觉快照。

## 已知未完成与风险

这不是已发布的 V3。最近的双重审查确认以下问题必须由 Windows Codex 继续处理：

- 点击结束后复盘填写期间仍可能继续计时，应先冻结并持久化结束时间。
- V3 导入的 Meditation 状态组合和成长记录一致性校验仍不够严格。
- 页面关闭后重新打开时，长时间间隔的休眠检测还需要持久化心跳支持。
- 多标签结束会话时，另一页需要可靠退出沉浸路由并清理旧复盘状态。
- Today/快速开始的 Meditation 入口、呼吸阶段轻提示音、冥想专用休眠文案和部分无障碍行为仍需补齐。

## 当前验证证据

上一次 Ubuntu 验证记录：

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test -- --run`：92 tests passed。
- `npm run build`：通过。
- `npm run test:e2e`：26 tests passed。

这些结果证明当前本地流程可运行，但不代表上面的审查问题已经解决。Windows 接手后应先重新运行所有检查，再修复风险并新增回归测试。

## Ubuntu 上运行

项目路径：`/home/minglee/Projects/studyflow`

```bash
cd /home/minglee/Projects/studyflow
export PATH="$HOME/.local/opt/node-v24.19.0-linux-x64/bin:$PATH"
npm install
npm run dev
```

也可以使用：

```bash
./studyflow.sh
```

浏览器访问 `http://127.0.0.1:5173`。设计样板使用 `http://127.0.0.1:5173/?design-preview=1`。

## Windows Codex 接手顺序

1. 先执行 `git status`、`git branch -vv`，确认工作区和远端分支。
2. 阅读本文件、`PRODUCT.md`、`ROADMAP.md` 和最近提交记录。
3. 重新运行 typecheck、lint、unit、E2E 和 build。
4. 先修复“已知未完成与风险”，并为每个修复增加回归测试。
5. 再进行两次独立只读审查和完整本地验收。
6. 只在用户确认后创建 Draft PR；不要自动合并 `main` 或创建正式版本标签。
