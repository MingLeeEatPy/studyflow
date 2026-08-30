import { describe, expect, it } from "vitest";
import { decideInitialSync, hasMeaningfulLocalData, scopedSyncStorageKey, syncErrorStatus } from "../src/features/syncService";

const stamp = "2026-08-30T08:00:00.000Z";

function backupData(overrides: Record<string, unknown> = {}) {
  return {
    categories: ["高数", "线性代数", "C", "CS50", "其他"].map((name, index) => ({
      id: `category-${index}`, name, sortOrder: index, archivedAt: null, createdAt: stamp, updatedAt: stamp,
    })),
    tasks: [], taskEvents: [], planningPeriods: [], studySessions: [], studyIntervals: [], sessionRevisions: [],
    growthRecords: [], meditationSessions: [], meditationIntervals: [], dailyReviews: [],
    executionSettings: { id: "default", updatedAt: stamp },
    ...overrides,
  };
}

describe("自动云同步生命周期", () => {
  it("只包含默认分类和默认设置时视为空设备", () => {
    expect(hasMeaningfulLocalData(backupData())).toBe(false);
    expect(hasMeaningfulLocalData(backupData({ tasks: [{ id: "task-1" }] }))).toBe(true);
    expect(hasMeaningfulLocalData(backupData({ categories: [...backupData().categories, { id: "custom", name: "概率论" }] }))).toBe(true);
  });

  it("同步游标、快照和初始化标记按账号隔离", () => {
    expect(scopedSyncStorageKey("cursor", "user-a")).not.toBe(scopedSyncStorageKey("cursor", "user-b"));
    expect(scopedSyncStorageKey("snapshot", "user-a")).toContain("user-a");
    expect(scopedSyncStorageKey("initialized", "user-a")).toContain("initialized");
  });

  it("空设备自动下载、空云端自动上传，只有两边都有真实数据才询问", () => {
    expect(decideInitialSync(false, false, true)).toBe("download-cloud");
    expect(decideInitialSync(false, true, false)).toBe("upload-local");
    expect(decideInitialSync(false, true, true)).toBe("ask-merge");
    expect(decideInitialSync(true, true, true)).toBe("incremental");
  });

  it("401 属于登录过期，只有网络异常才显示离线", () => {
    expect(syncErrorStatus(new Error("同步下载失败（401）：JWT expired"))).toBe("signed-out");
    expect(syncErrorStatus(new TypeError("Failed to fetch"))).toBe("offline");
    expect(syncErrorStatus(new Error("数据库约束错误"))).toBe("error");
  });
});
