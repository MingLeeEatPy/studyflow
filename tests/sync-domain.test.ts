import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db/database";
import { compareByUpdatedAt, enqueueSyncChange, markSyncChangesSynced, pendingSyncChanges } from "../src/domain/sync";

describe("本地同步队列", () => {
  beforeEach(async () => { await db.syncOutbox.clear(); });
  afterEach(async () => { await db.syncOutbox.clear(); });

  it("按创建时间返回待同步变更，并压缩同一实体连续 upsert", async () => {
    await enqueueSyncChange({ entityType: "task", entityId: "task-1", operation: "upsert", payload: { title: "旧" }, updatedAt: "2026-08-26T08:00:00.000Z" });
    await enqueueSyncChange({ entityType: "task", entityId: "task-1", operation: "upsert", payload: { title: "新" }, updatedAt: "2026-08-26T08:01:00.000Z" });
    await enqueueSyncChange({ entityType: "category", entityId: "category-1", operation: "upsert", payload: { name: "数学" }, updatedAt: "2026-08-26T08:02:00.000Z" });

    const pending = await pendingSyncChanges();
    expect(pending).toHaveLength(2);
    expect(pending[0].payload).toEqual({ title: "新" });
    expect(pending[1].entityId).toBe("category-1");
  });

  it("标记完成后不再出现在待同步队列", async () => {
    const change = await enqueueSyncChange({ entityType: "growthRecord", entityId: "growth-1", operation: "upsert", payload: { stage: 2 }, updatedAt: "2026-08-26T08:00:00.000Z" });
    await markSyncChangesSynced([change.id]);
    expect(await pendingSyncChanges()).toEqual([]);
  });

  it("同一版本在已同步后再次扫描不会重复入队", async () => {
    const first = await enqueueSyncChange({ entityType: "task", entityId: "task-1", operation: "upsert", payload: { title: "稳定" }, updatedAt: "2026-08-26T08:00:00.000Z" });
    await markSyncChangesSynced([first.id]);
    const second = await enqueueSyncChange({ entityType: "task", entityId: "task-1", operation: "upsert", payload: { title: "稳定" }, updatedAt: "2026-08-26T08:00:00.000Z" });
    expect(second.id).toBe(first.id);
    expect(await pendingSyncChanges()).toEqual([]);
  });

  it("以更新时间解决可修改实体冲突，同一时间使用 id 保证确定性", () => {
    expect(compareByUpdatedAt({ id: "a", updatedAt: "2026-08-26T08:00:01.000Z" }, { id: "b", updatedAt: "2026-08-26T08:00:00.000Z" })).toBe("local");
    expect(compareByUpdatedAt({ id: "a", updatedAt: "2026-08-26T08:00:00.000Z" }, { id: "b", updatedAt: "2026-08-26T08:00:00.000Z" })).toBe("remote");
  });
});
