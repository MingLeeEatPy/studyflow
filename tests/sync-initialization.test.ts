import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultExecutionSettings, db } from "../src/db/database";

const transport = vi.hoisted(() => ({ pull: vi.fn(), push: vi.fn() }));

vi.mock("../src/features/authAdapter", () => ({
  authAdapter: {
    isConfigured: () => true,
    getAccessToken: () => "test-token",
    getUserId: () => "user-1",
  },
}));

vi.mock("../src/features/syncTransport", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/features/syncTransport")>();
  return { ...original, pullSyncChanges: transport.pull, pushSyncChanges: transport.push };
});

import { initializeCloudSync, syncNow } from "../src/features/syncService";
import type { RemoteSyncEntity } from "../src/features/syncTransport";

const stamp = "2026-08-30T08:00:00.000Z";

function category(id: string) {
  return { id, name: "线性代数", sortOrder: 0, archivedAt: null, createdAt: stamp, updatedAt: stamp };
}

function task(id: string, categoryId: string) {
  return {
    id, title: "矩阵练习", categoryId, estimatedMinutes: 30, dueDate: "2026-08-30",
    important: true, urgent: false, planId: null, isCoreTask: false, avoidanceCount: 0,
    minimumStartMinutes: null, completed: false, completedAt: null, archivedAt: null,
    createdAt: stamp, updatedAt: stamp,
  };
}

function remote(entityType: RemoteSyncEntity["entity_type"], entityId: string, payload: unknown): RemoteSyncEntity {
  return { entity_type: entityType, entity_id: entityId, payload, created_at: stamp, updated_at: stamp, deleted_at: null };
}

async function resetLocal(localTask = false) {
  await db.open();
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.categories.add(category("local-category"));
    await db.executionSettings.put(defaultExecutionSettings(stamp));
    if (localTask) await db.tasks.add(task("local-task", "local-category"));
  });
  localStorage.clear();
  transport.pull.mockReset();
  transport.push.mockReset().mockResolvedValue(undefined);
}

describe("云同步初始化", () => {
  beforeEach(async () => { await resetLocal(); });

  it("空白 iPad 自动恢复电脑云端数据，不全量回传下载内容", async () => {
    const cloudCategory = category("cloud-category");
    const cloudTask = task("cloud-task", cloudCategory.id);
    const changes = [remote("category", cloudCategory.id, cloudCategory), remote("task", cloudTask.id, cloudTask)];
    transport.pull.mockResolvedValue({ changes, cursor: stamp });

    const initialized = await initializeCloudSync();

    expect(initialized.mergeSummary).toBeNull();
    expect(initialized.result.status).toBe("synced");
    expect(initialized.result.downloaded).toBe(2);
    expect(await db.tasks.get(cloudTask.id)).toEqual(cloudTask);
    const uploadedCount = transport.push.mock.calls.flatMap((call) => call[0]).length;
    expect(uploadedCount).toBeLessThanOrEqual(1);

    transport.push.mockClear();
    transport.pull.mockResolvedValue({ changes: [], cursor: stamp });
    await syncNow();
    expect(transport.push).toHaveBeenCalledWith([]);
  });

  it("两边都有真实任务时只询问一次，不在确认前上传", async () => {
    await resetLocal(true);
    const cloudCategory = category("cloud-category");
    const cloudTask = task("cloud-task", cloudCategory.id);
    const changes = [remote("category", cloudCategory.id, cloudCategory), remote("task", cloudTask.id, cloudTask)];
    transport.pull.mockResolvedValue({ changes, cursor: stamp });

    const initialized = await initializeCloudSync();

    expect(initialized.mergeSummary).not.toBeNull();
    expect(transport.push).not.toHaveBeenCalled();
    expect(await db.tasks.get(cloudTask.id)).toBeUndefined();
  });
});
