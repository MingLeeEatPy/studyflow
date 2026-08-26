# StudyFlow 跨设备同步 SPEC

状态：实现中（本地基础阶段）  
范围：同一用户在电脑与手机之间共享 StudyFlow 数据，同时保留 IndexedDB 离线优先能力。

## 1. 背景与目标

StudyFlow 当前以浏览器 IndexedDB 保存任务、计划、专注、冥想、成长和复盘数据。不同设备的浏览器拥有不同的本地数据库，因此同一用户在电脑和手机上打开应用时看不到彼此的数据。

本版本的目标是：用户使用邮箱魔法链接登录后，能够在多个设备上看到同一份数据；网络中断时仍可正常学习、计时和记录，恢复网络后自动同步。

本版本不做：学校账号接入、抓取学校网站、社交分享、实时协作、服务端计时、删除现有本地数据或重建 Garden 历史记录。

## 2. 用户流程

### 2.1 未登录

- 应用继续完全使用本地 IndexedDB。
- 用户可以创建任务、计划、学习会话、冥想会话、成长记录和每日复盘。
- 页面提示“仅保存在此设备”，不阻塞现有功能。

### 2.2 首次登录

1. 用户输入邮箱并请求魔法链接。
2. 邮箱链接回到当前 HTTPS 地址并建立 Supabase 会话。
3. 应用立即生成并允许下载本地备份。
4. 应用展示本地数据摘要和云端数据摘要。
5. 用户选择“合并本地数据”或“只保留云端数据”；默认不自动覆盖。
6. 合并完成后建立同步游标，并显示同步状态。

### 2.3 日常使用

- 所有本地写入先完成 IndexedDB 写入，再异步进入同步队列。
- 有网络时自动批量上传本地变更并拉取远端变更。
- 无网络时继续使用本地数据，队列保留到网络恢复。
- 用户可在设置中手动执行“立即同步”和“导出备份”。

## 3. 同步范围

第一版同步以下实体：

| 实体 | 同步方式 | 主键 |
| --- | --- | --- |
| 分类 | 可修改实体，按 `updatedAt` | category id |
| 任务 | 可修改实体，按 `updatedAt` | task id |
| 月度目标/周里程碑 | 可修改实体，按 `updatedAt` | planning period id |
| 学习会话 | 追加式 | study session id |
| 学习计时区间 | 追加式 | study interval id |
| 学习历史修正 | 追加式 | revision id |
| 成长记录 | 追加式 | growth record id |
| 冥想会话 | 追加式 | meditation session id |
| 冥想计时区间 | 追加式 | meditation interval id |
| 每日复盘 | 按日期单记录，按 `updatedAt` | review id |
| 专注设置 | 单用户配置，按 `updatedAt` | `default` |

删除采用 tombstone（带 `deletedAt` 的变更）并保留至少 30 天，避免另一台离线设备把已删除数据重新上传。

## 4. 本地数据层

新增 IndexedDB 表 `syncOutbox`：

```ts
type SyncChange = {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: "upsert" | "delete";
  payload: unknown;
  updatedAt: string;
  createdAt: string;
  syncedAt: string | null;
  attemptCount: number;
  lastError: string | null;
};
```

本地写入必须满足：

- 先写业务表，再写 outbox；
- outbox 写失败不能回滚已经成功的本地业务写入，但必须显示待同步状态；
- 同一实体连续 upsert 可压缩为最新 payload；
- 追加式实体不能通过压缩丢失历史记录；
- 应用启动、网络恢复、登录成功和用户手动操作都会触发同步。

## 5. 云端数据模型

Supabase Postgres 使用统一实体表，避免为每个本地表重复实现同步协议：

```sql
create table public.sync_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, entity_type, entity_id)
);
```

所有读写必须通过 RLS 限制为 `auth.uid() = user_id`。前端只使用 Supabase anon key，不保存 service role key。

## 6. 冲突规则

- 任务、分类、计划和专注设置：比较 ISO `updatedAt`，较新的记录胜出；时间相同则以确定性的 id 排序。
- 学习会话、计时区间、历史修正、成长记录、冥想会话、冥想区间：按稳定 id 去重后追加，不覆盖另一设备已有记录。
- 每日复盘：同一 `localDate + timezone` 视为同一条可修改记录，按 `updatedAt` 解决冲突。
- 解析失败或 schema 校验失败的远端记录不写入本地，进入同步错误列表并允许导出诊断信息。

## 7. 安全与隐私

- 登录使用 Supabase Auth 邮箱魔法链接。
- 用户只能读取和写入自己的云端实体。
- 本地备份由用户主动下载，不自动上传到第三方存储。
- 环境变量只保存公开 Supabase URL 和 anon key；任何密钥不进入 Git。
- 登出后停止自动同步，但不删除本地数据。

## 8. UI 要求

设置页增加账户与同步区域：

- 未登录：邮箱输入、发送登录链接、仅本设备提示；
- 已登录：邮箱、同步状态、最后同步时间、立即同步、导出备份、合并本地数据、登出；
- 首次合并：本地/云端数量摘要、冲突数量、明确确认按钮；
- 状态文案：`仅保存在此设备`、`离线待同步`、`正在同步`、`已同步`、`同步失败`。

## 9. 验收标准

- 两个浏览器使用同一账号后，任务、计划、学习/冥想记录、成长记录和复盘可以互相出现。
- 首次登录不会静默覆盖本地数据，取消合并不会改变本地数据。
- 离线创建任务和完成专注后，恢复网络能够自动上传且不重复。
- 同一任务在两台设备分别修改时，最终结果遵守 `updatedAt` 规则。
- 两台设备分别产生的学习会话、计时区间和 Garden 植物全部保留。
- 删除不会被离线旧设备重新创建。
- Supabase 不可用时，Today、Focus、Meditation、History、Garden 仍可本地工作。
- 现有单元测试、E2E、PWA 离线测试和构建全部通过。

## 10. 分阶段交付

1. 本地同步元数据、outbox、schema 校验和单元测试。
2. Supabase 客户端、认证适配器、SQL migration 和 RLS。
3. 首次备份、云端预览、本地合并和追加式数据导入。
4. 推送/拉取、游标、重试、网络恢复和冲突处理。
5. 设置页入口、状态提示、E2E/PWA 验收、文档和最终部署。

Garden 改动继续保留在本地，最终与同步功能一起提交。
