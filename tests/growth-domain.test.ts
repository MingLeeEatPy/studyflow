import { describe, expect, it } from "vitest";
import type { StudySession } from "../shared/schemas/models";
import {
  calculateGrowthStage,
  createStudyGrowthRecord,
  localDateInTimezone,
  stablePlantVariant,
  studyGrowthTargetSeconds,
} from "../src/domain/growth";

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: "session-stable", taskId: null, categoryId: "category-1", taskTitleSnapshot: "自由学习",
    categoryNameSnapshot: "其他", estimatedMinutesSnapshot: null, goal: "", mode: "stopwatch",
    pomodoroSettingsSnapshot: null, status: "finished", activeIntervalId: null, pomodoroRound: 1,
    startedAt: "2026-08-14T15:50:00.000Z", endedAt: "2026-08-14T16:10:00.000Z",
    timezone: "Asia/Shanghai", outcome: "completed", failureReason: null, note: "", summary: "",
    revision: 1, createdAt: "2026-08-14T15:50:00.000Z", updatedAt: "2026-08-14T16:10:00.000Z",
    ...overrides,
  };
}

describe("成长阶段与稳定植物", () => {
  it.each([
    [0, 0], [0.099, 0], [0.1, 1], [0.349, 1], [0.35, 2], [0.649, 2],
    [0.65, 3], [0.999, 3], [1, 4], [1.8, 4],
  ] as const)("成长比例 %s 对应阶段 %s", (ratio, stage) => {
    expect(calculateGrowthStage(ratio * 1000, 1000)).toBe(stage);
  });

  it("关联任务、临时番茄和自由正计时使用各自成长目标", () => {
    expect(studyGrowthTargetSeconds(session({ taskId: "task-1", estimatedMinutesSnapshot: 45 }))).toBe(45 * 60);
    expect(studyGrowthTargetSeconds(session({ mode: "pomodoro", pomodoroSettingsSnapshot: {
      focusMinutes: 30, shortBreakMinutes: 5, longBreakMinutes: 15, roundsPerSet: 4,
    } }))).toBe(30 * 60);
    expect(studyGrowthTargetSeconds(session())).toBe(25 * 60);
  });

  it("同一会话始终得到相同变体，并按会话时区记录完成日期", () => {
    expect(stablePlantVariant("same-session")).toBe(stablePlantVariant("same-session"));
    expect(localDateInTimezone("2026-08-14T16:10:00.000Z", "Asia/Shanghai")).toBe("2026-08-15");
    expect(createStudyGrowthRecord(session(), "growth-1", "2026-08-14T16:10:00.000Z")).toMatchObject({
      sourceType: "study", sourceSessionId: "session-stable", plantType: "tree",
      targetSecondsSnapshot: 25 * 60, localDate: "2026-08-15", timezone: "Asia/Shanghai",
    });
  });
});
