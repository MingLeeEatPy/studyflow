# StudyFlow V1 测试契约与架构审查

## 预期接口

测试草案假定领域层提供 `getQuadrant`、`getTodayTasks`、`getTodayStats` 和 `localDateKey`；Repository 提供任务 CRUD/归档/完成切换、分类 CRUD/归档以及数据库初始化；备份层提供 `exportBackup`、`validateBackup` 与事务性 `replaceFromBackup`。实际实现可调整模块路径，但不应削弱这些行为。

E2E（端到端）测试依赖稳定的可访问名称，包括表单 `label`、按钮名称、页面导航、确认对话框，以及 Today 三个统计值的 `data-testid`。推荐优先使用语义化 HTML；`data-testid` 只用于没有自然语义的数值。

## 数据分析扩展性风险

1. `TaskEvent.snapshot` 若只保存 `categoryId`，分类改名或归档后无法还原历史展示名称。建议快照同时保存 `categoryName`，或为分类建立 `CategoryEvent` 历史；后者更利于长期分析。
2. `updated` 事件不能只存编辑后的快照，否则无法直接分析预计时长和截止日期发生了什么变化。建议事件保存完整新快照，并可选保存 `changes`（旧值/新值）；原始快照足以重放，但差异字段更利于分析。
3. 完成率的分母必须定义。建议未来按“在统计周期内到期的、非归档任务”计算，另行展示周期内创建量与完成量，避免把长期未来任务计入本周完成率。
4. 归档分类如果被历史任务引用必须保留。数据库和导出格式应包含归档分类，普通 UI 查询才过滤；否则历史按科目统计会断链。
5. V2 `StudySession.actualMinutes` 不应成为唯一真相。保存 `startedAt`、`endedAt`、暂停区间或累计有效秒数，并以整数秒保存原始时长；显示时再换算分钟，避免多次短 session 的舍入误差。
6. 时间字段统一保存 ISO UTC instant，日/周/月分组时使用记录产生时的用户时区。若只用“当前时区”回算，用户旅行或更改时区后历史日期可能移动。V2 起建议每个 session 保存 `timeZone`（IANA 名称）和可选 `localDate`。
7. 覆盖导入必须在单个 IndexedDB transaction 中校验引用并替换所有表。所谓“导入前自动导出”受浏览器下载策略影响，不能证明用户真正保存了文件；UI 应明确提示，并在下载触发后才允许最终确认，或将安全快照暂存为单独 IndexedDB 恢复点。
8. ID 冲突在覆盖导入中不是问题，但 schema migration 必须逐版本迁移，禁止直接猜测未来版本。备份文件应独立于内部 Dexie schema version，保持显式 `format` 和 `version`。
9. 浏览器会在存储压力下清理非持久站点数据。部署后可尝试 `navigator.storage.persist()` 并清楚提示备份；它不能代替导出/同步。
10. 当前多个操作可在同一毫秒生成相同的 `occurredAt`，仅按该字段排序无法保证事件先后顺序。为可靠重放和分析，应给事件增加单调递增序号（例如每任务 `sequence`）或采用可排序且保证唯一的 ID；时间戳仍保留用于时间分析。
11. 默认分类在同一毫秒创建，当前 Repository 用 `createdAt` 排序会让 `C` 与 `CS50` 等同时间项目次序不稳定。若 UI 要求固定默认顺序，应增加 `sortOrder`，不要依赖相同时间戳的排序稳定性。

## 运行前适配清单

- 根据最终源码调整 import path 与 Repository 方法名。
- Vitest 使用 `fake-indexeddb` 且测试环境具备 `crypto.randomUUID`。
- Playwright 将系统时间固定为 `2026-08-14`，否则 Today 测试应动态生成本地日期。
- 每个 E2E 测试使用独立 browser context，并可靠等待 `deleteDatabase` 完成。
- 导入 E2E 应使用实现导出的真实 fixture，避免测试 fixture 和 schema 分叉。
