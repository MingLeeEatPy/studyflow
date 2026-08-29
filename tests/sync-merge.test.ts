import { beforeEach, describe, expect, it } from "vitest";
import type { Category, Task } from "../src/domain/models";
import { db } from "../src/db/database";
import { pendingSyncChanges } from "../src/domain/sync";
import { applyRemoteEntity, normalizeRemoteEntities } from "../src/features/syncMerge";
import type { RemoteSyncEntity } from "../src/features/syncTransport";

const stamp = "2026-08-20T08:00:00.000Z";

function category(id: string, name = "线性代数", createdAt = stamp): Category {
  return { id, name, sortOrder: 0, archivedAt: null, createdAt, updatedAt: createdAt };
}

function task(id: string, categoryId: string): Task {
  return {
    id, title: "矩阵练习", categoryId, estimatedMinutes: 30, dueDate: "2026-08-29",
    important: true, urgent: false, planId: null, isCoreTask: false, avoidanceCount: 0,
    minimumStartMinutes: null, completed: false, completedAt: null, archivedAt: null,
    createdAt: stamp, updatedAt: stamp,
  };
}

function remote(entityType: RemoteSyncEntity["entity_type"], entityId: string, payload: unknown): RemoteSyncEntity {
  return { entity_type: entityType, entity_id: entityId, payload, created_at: stamp, updated_at: stamp, deleted_at: null };
}

describe("跨设备唯一索引合并", () => {
  beforeEach(async () => {
    await db.open();
    await db.transaction("rw", [db.categories, db.tasks, db.studySessions, db.taskEvents, db.growthRecords, db.dailyReviews, db.syncOutbox], async () => {
      await Promise.all([
        db.categories.clear(), db.tasks.clear(), db.studySessions.clear(), db.taskEvents.clear(),
        db.growthRecords.clear(), db.dailyReviews.clear(), db.syncOutbox.clear(),
      ]);
    });
  });

  it("复现旧实现的分类名称唯一索引错误，并在合并时消除冲突", async () => {
    const local = category("local-category");
    const cloud = category("cloud-category", local.name, "2026-08-10T08:00:00.000Z");
    await db.categories.add(local);
    await db.tasks.add(task("local-task", local.id));

    await expect(db.categories.put(cloud)).rejects.toMatchObject({ name: "ConstraintError" });
    await expect(applyRemoteEntity(remote("category", cloud.id, cloud))).resolves.toBe(true);

    expect(await db.categories.where("name").equals(local.name).toArray()).toEqual([cloud]);
    expect((await db.tasks.get("local-task"))?.categoryId).toBe(cloud.id);
    expect((await pendingSyncChanges()).some((change) => change.entityId === local.id && change.operation === "delete")).toBe(true);
  });

  it("折叠云端重复分类，并把任务引用统一到最早的分类 id", () => {
    const canonical = category("computer-category", "CS50", "2026-08-01T08:00:00.000Z");
    const duplicate = category("ipad-category", "CS50", "2026-08-28T08:00:00.000Z");
    const ipadTask = task("ipad-task", duplicate.id);

    const normalized = normalizeRemoteEntities([
      remote("category", duplicate.id, duplicate),
      remote("task", ipadTask.id, ipadTask),
      remote("category", canonical.id, canonical),
    ]);

    expect(normalized.filter((item) => item.entity_type === "category")).toHaveLength(1);
    expect(normalized.find((item) => item.entity_type === "category")?.entity_id).toBe(canonical.id);
    expect((normalized.find((item) => item.entity_type === "task")?.payload as Task).categoryId).toBe(canonical.id);
  });

  it("成长记录来源相同但 id 不同时只保留云端记录", async () => {
    const local = {
      id: "local-growth", sourceType: "study" as const, sourceSessionId: "session-1", plantType: "tree" as const,
      variant: 0, targetSecondsSnapshot: 1500, localDate: "2026-08-29", timezone: "Asia/Shanghai", createdAt: stamp,
    };
    const cloud = { ...local, id: "cloud-growth", variant: 1 as const };
    await db.growthRecords.add(local);

    await expect(applyRemoteEntity(remote("growthRecord", cloud.id, cloud))).resolves.toBe(true);
    expect(await db.growthRecords.where("sourceSessionId").equals("session-1").toArray()).toEqual([cloud]);
  });

  it("同一天复盘 id 不同时按更新时间保留较新记录", async () => {
    const local = {
      id: "local-review", localDate: "2026-08-29", timezone: "Asia/Shanghai",
      plannedMinutes: 30, completedMinutes: 20, actualFocusMinutes: 20,
      matchesExpectation: "partly" as const, blocker: "手机", nextStep: "先做练习",
      createdAt: stamp, updatedAt: "2026-08-29T08:00:00.000Z",
    };
    const cloud = { ...local, id: "cloud-review", blocker: "睡眠不足", updatedAt: "2026-08-29T09:00:00.000Z" };
    await db.dailyReviews.add(local);

    await expect(applyRemoteEntity(remote("dailyReview", cloud.id, cloud))).resolves.toBe(true);
    expect(await db.dailyReviews.where("localDate").equals(local.localDate).toArray()).toEqual([cloud]);
  });
});
