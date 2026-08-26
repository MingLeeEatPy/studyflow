import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { StudyFlowDatabase } from "../src/db/database";

describe("V5 到 V6 IndexedDB migration", () => {
  it("为已有声音设置补齐自然声音的安全默认值", async () => {
    const name = `studyflow-v5-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(5).stores({
      tasks: "id, categoryId, planId, isCoreTask, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt", executionSettings: "id",
      growthRecords: "id, &sourceSessionId, sourceType, plantType, localDate, createdAt",
      meditationSessions: "id, status, mode, startedAt, endedAt, updatedAt",
      meditationIntervals: "id, sessionId, kind, startedAt, endedAt",
      planningPeriods: "id, type, parentId, startDate, endDate, createdAt",
      dailyReviews: "id, &localDate, updatedAt",
    });
    await legacy.open();
    await legacy.table("executionSettings").add({
      id: "default", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, roundsPerSet: 4,
      soundEnabled: true, soundVolume: 65, notificationsEnabled: false, stopwatchAutoPauseMinutes: 240,
      updatedAt: "2026-08-22T00:00:00.000Z",
    });
    legacy.close();

    const upgraded = new StudyFlowDatabase(name);
    await upgraded.open();
    expect(await upgraded.executionSettings.get("default")).toMatchObject({
      ambientSound: "off", ambientVolume: 50, completionSound: "wind-chime", soundVolume: 65,
    });
    await upgraded.delete();
  });
});
