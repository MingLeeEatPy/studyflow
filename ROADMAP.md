# StudyFlow Roadmap

## V3 status — Personal Complete Version

V3 is complete for personal dogfooding: monthly and weekly planning, a linked Today #1 priority, minimum-start activation, weighted Growth Garden feedback, and independent Meditation/Recovery are available locally. v4 begins only after real dogfooding evidence; v5 scope will be determined by dogfooding and Public Beta feedback.

## 当前交接点

- V1 Plan：已完成。
- V2 Execution：已完成主要功能，当前版本仍需在后续发布流程中确认版本号和合并目标。
- V3 Growth Garden + Meditation：本地分支已有实现和测试，但本次只完成安全交接，不继续添加新功能。

## V3 尚未完成或需要下一位 Agent 继续处理

1. 结束 Meditation 时需要先持久化冻结计时，再打开复盘；填写复盘的时间不能继续计入本次冥想。
2. V3 备份导入需要完整验证 Meditation 状态机、区间组合、`<60 秒` 丢弃规则和成长花记录的一致性。
3. 重新打开浏览器时，需要基于持久化心跳识别页面关闭期间的长时间休眠间隔。
4. 结束/切换标签页后的沉浸页面、复盘弹窗和活动会话状态需要更严格地按 session ID 清理。
5. Today 与快速开始需要增加 Meditation 快捷入口。
6. 呼吸阶段的轻提示音、冥想专用休眠提示文案以及 Meditation 的无障碍 live region/焦点管理仍需完善。
7. 完成上述修复后，再进行独立审查、提交、Draft PR、用户验收和正式合并；不要直接合并到 `main`。

## 后续路线

- V3 收尾：完成上述状态与交互边界后发布。
- V4：学习时长、完成率、预计/实际比较、周报趋势，以及按需要设计账号和同步。
- V5：基于目标、截止日期、可用时间和历史执行能力的 AI Planner。
