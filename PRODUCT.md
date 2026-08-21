# StudyFlow 产品交接说明

## V3 release state

Current local version: **0.3.0**. The personal workflow is Monthly/Weekly Plan → Today #1 → Focus/Minimum Start → Growth/History, with Meditation as an independent recovery module. Data remains local-first in IndexedDB and backup format v4 preserves planning data while importing v1–v3 backups.

## 当前版本

当前工作区位于 `feature/v3-meditation`，目标版本为 V3 开发中间态。V1 与 V2 的核心计划和执行功能已经进入可运行状态；V3 的成长花园和 Meditation 已在本地完成一轮实现，但尚未合并到 `main`，也尚未发布正式版本号。

## 产品定位

StudyFlow 是 Web-first、本地优先的个人学习计划与执行助手，核心闭环是：

`Plan → Execute → Record`

当前不包含账号、云同步、PWA、好友自习室、完整分析图表、白噪音课程或 AI Planner。

## 已完成能力

- 任务、分类、Today、四象限和本地 IndexedDB 持久化。
- Stopwatch、Pomodoro、Focus Mode、暂停/恢复/休息/超时正计时。
- 任务结果、未完成原因、总结、History 和带审计记录的修正。
- V1/V2 数据迁移与 JSON 备份导入导出。
- V3 数据库结构、`GrowthRecord`、五阶段学习成长树和 Today 花园。
- Meditation 的定时/自由模式、4-7-8/均衡/箱式/无引导、暂停恢复、复盘、冥想花和 History 类型筛选。
- 刷新恢复、BroadcastChannel 多标签同步、休眠时间确认的基础流程。

## 当前交接状态

本次 Ubuntu 任务的目标是安全保存并同步现有工作，不继续扩展 Roadmap。V3 代码保留为可供 Windows Codex 继续审查的开发中间态；不要把当前状态当作已发布的 V3 成品。
