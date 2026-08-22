# 菜根谭界面文案替换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将确认清单中的页面气质标题和引文替换为指定《菜根谭》原句，不改变功能逻辑、交互或结构。

**Architecture:** 仅修改现有 React 页面/组件中的展示字符串；不新增状态、数据字段、路由或样式规则。替换后通过搜索、类型检查和构建确认功能代码未受影响。

**Tech Stack:** React、TypeScript、Vite。

## Global Constraints

- 只替换确认清单指定的标题、引文或辅助说明。
- 保留按钮、表单字段、筛选器、统计标签和功能说明。
- “科目与分类”及其副标题保持不变。
- 不改组件结构、路由、数据模型、任务/冥想/复盘逻辑或视觉风格。

### Task 1: 替换已确认页面文案

**Files:**
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/components/DailyReviewPanel.tsx`
- Modify: `src/pages/MeditationPage.tsx`
- Modify: `src/pages/PlanPage.tsx`
- Modify: `src/components/PlanningPanel.tsx`
- Modify: `src/pages/HistoryPage.tsx`

- [ ] 将 7 处现有标题/引文替换为说明中给定的原句，保留周边功能说明。
- [ ] 用 `rg` 检查旧文案和新文案出现位置。

### Task 2: 验证

- [ ] 运行 `npm.cmd run typecheck`。
- [ ] 运行 `npm.cmd run build`。
- [ ] 确认 `src/pages/CategoriesPage.tsx` 的两个既定文案未改变。
