import { describe, expect, it } from "vitest";
import type { GrowthRecord, MeditationSession, StudySession } from "../shared/schemas/models";
import { buildGardenEntries } from "../src/domain/garden";

function studySession(id: string): StudySession {
  return {
    id, taskId: `task-${id}`, categoryId: "category-1", taskTitleSnapshot: `任务 ${id}`,
    categoryNameSnapshot: "线性代数", estimatedMinutesSnapshot: 30, goal: "", mode: "stopwatch",
    pomodoroSettingsSnapshot: null, status: "finished", activeIntervalId: null, pomodoroRound: 1,
    startedAt: "2026-08-20T01:00:00.000Z", endedAt: "2026-08-20T01:30:00.000Z", timezone: "Asia/Shanghai",
    outcome: "completed", failureReason: null, note: "", summary: "", revision: 1,
    createdAt: "2026-08-20T01:00:00.000Z", updatedAt: "2026-08-20T01:30:00.000Z",
  };
}

function meditationSession(id: string): MeditationSession {
  return {
    id, mode: "timed", status: "finished", intention: "calm", intentionNote: "", breathingPattern: "none", breathingRounds: 0,
    targetSeconds: 600, activeIntervalId: null, startedAt: "2026-08-19T12:00:00.000Z", meditationStartedAt: "2026-08-19T12:00:00.000Z",
    endedAt: "2026-08-19T12:10:00.000Z", timezone: "Asia/Shanghai", feeling: 2, note: "", revision: 1,
    createdAt: "2026-08-19T12:00:00.000Z", updatedAt: "2026-08-19T12:10:00.000Z",
  };
}

function record(id: string, sourceType: GrowthRecord["sourceType"], sourceSessionId: string, localDate: string, targetSecondsSnapshot: number): GrowthRecord {
  return { id, sourceType, sourceSessionId, plantType: sourceType === "study" ? "tree" : "flower", variant: 1, targetSecondsSnapshot, localDate, timezone: "Asia/Shanghai", createdAt: `${localDate}T12:00:00+08:00` };
}

describe("历史 Garden 聚合", () => {
  it("按日期倒序展示学习树和冥想花，并依据有效时长计算阶段", () => {
    const entries = buildGardenEntries(
      [record("growth-study", "study", "study-1", "2026-08-20", 1800), record("growth-meditation", "meditation", "meditation-1", "2026-08-19", 600)],
      [studySession("study-1")], { "study-1": 1800 }, [meditationSession("meditation-1")], { "meditation-1": 60 },
    );

    expect(entries.map((entry) => entry.localDate)).toEqual(["2026-08-20", "2026-08-19"]);
    expect(entries[0]).toMatchObject({ record: { plantType: "tree" }, title: "任务 study-1", durationSeconds: 1800, stage: 4 });
    expect(entries[1]).toMatchObject({ record: { plantType: "flower" }, title: "平静", durationSeconds: 60, stage: 1 });
  });

  it("不为找不到原始会话的旧成长记录生成孤立植物", () => {
    const entries = buildGardenEntries([record("orphan", "study", "missing", "2026-08-18", 600)], [], {}, [], {});
    expect(entries).toEqual([]);
  });
});
