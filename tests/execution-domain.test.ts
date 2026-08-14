import { describe, expect, it } from "vitest";
import {
  hasUnresolvedSleepGap,
  intervalActiveMs,
  intervalEffectiveMs,
  shouldAutoPause,
  sessionFocusSecondsOnLocalDate,
  splitIntervalByLocalDate,
  taskFocusSecondsOnLocalDate,
  totalFocusMs,
} from "../src/domain/execution";
import type { StudyInterval, StudySession } from "../shared/schemas/models";

function interval(overrides: Partial<StudyInterval> = {}): StudyInterval {
  return {
    id: crypto.randomUUID(),
    sessionId: "session-1",
    kind: "focus",
    pomodoroRound: null,
    targetSeconds: null,
    startedAt: "2026-08-14T00:00:00.000Z",
    endedAt: "2026-08-14T01:00:00.000Z",
    pauses: [],
    sleepGaps: [],
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T01:00:00.000Z",
    ...overrides,
  };
}

describe("执行时长计算", () => {
  it("仅累计 focus，并排除完整或部分重叠的暂停区间", () => {
    const focus = interval({
      pauses: [
        { startedAt: "2026-08-14T00:10:00.000Z", endedAt: "2026-08-14T00:20:00.000Z" },
        { startedAt: "2026-08-14T00:50:00.000Z", endedAt: "2026-08-14T01:10:00.000Z" },
      ],
    });
    const breakInterval = interval({ kind: "break" });

    expect(intervalEffectiveMs(focus)).toBe(40 * 60_000);
    expect(intervalEffectiveMs(breakInterval)).toBe(0);
    expect(totalFocusMs([focus, breakInterval])).toBe(40 * 60_000);
  });

  it("休息阶段倒计时排除暂停时间，但不计入实际专注", () => {
    const breakInterval = interval({
      kind: "break",
      pauses: [{ startedAt: "2026-08-14T00:10:00.000Z", endedAt: "2026-08-14T00:30:00.000Z" }],
    });
    expect(intervalActiveMs(breakInterval)).toBe(40 * 60_000);
    expect(intervalEffectiveMs(breakInterval)).toBe(0);
  });

  it("按用户选择计入、排除或修正休眠间隔", () => {
    const baseGap = {
      detectedAt: "2026-08-14T00:50:00.000Z",
      from: "2026-08-14T00:20:00.000Z",
      to: "2026-08-14T00:50:00.000Z",
      correctedSeconds: null,
      resumeStatus: "running",
    } as const;

    expect(intervalEffectiveMs(interval({ sleepGaps: [{ ...baseGap, resolution: "include" }] }))).toBe(60 * 60_000);
    expect(intervalEffectiveMs(interval({ sleepGaps: [{ ...baseGap, resolution: "exclude" }] }))).toBe(30 * 60_000);
    expect(intervalEffectiveMs(interval({
      sleepGaps: [{ ...baseGap, resolution: "correct", correctedSeconds: 300 }],
    }))).toBe(35 * 60_000);
  });

  it("暂停与排除的休眠区间重叠时只扣除一次", () => {
    const value = interval({
      pauses: [{ startedAt: "2026-08-14T00:10:00.000Z", endedAt: "2026-08-14T00:30:00.000Z" }],
      sleepGaps: [{
        detectedAt: "2026-08-14T00:40:00.000Z",
        from: "2026-08-14T00:20:00.000Z",
        to: "2026-08-14T00:40:00.000Z",
        resolution: "exclude",
        correctedSeconds: null,
        resumeStatus: "running",
      }],
    });
    expect(intervalEffectiveMs(value)).toBe(30 * 60_000);
  });

  it("识别未处理的休眠间隔", () => {
    expect(hasUnresolvedSleepGap([interval({
      sleepGaps: [{
        detectedAt: "2026-08-14T00:50:00.000Z",
        from: "2026-08-14T00:20:00.000Z",
        to: "2026-08-14T00:50:00.000Z",
        resolution: null,
        correctedSeconds: null,
        resumeStatus: "running",
      }],
    })])).toBe(true);
    expect(hasUnresolvedSleepGap([interval()])).toBe(false);
  });

  it("正计时达到 4 小时才触发自动暂停", () => {
    const running = interval({ endedAt: null });
    expect(shouldAutoPause(running, 240, "2026-08-14T03:59:59.999Z")).toBe(false);
    expect(shouldAutoPause(running, 240, "2026-08-14T04:00:00.000Z")).toBe(true);
    expect(shouldAutoPause({ ...running, kind: "break" }, 240, "2026-08-14T05:00:00.000Z")).toBe(false);
  });

  it("按会话记录的时区把跨午夜专注时间分摊到两个本地日期", () => {
    const crossing = interval({
      startedAt: "2026-08-14T15:30:00.000Z",
      endedAt: "2026-08-14T16:30:00.000Z",
    });
    expect(splitIntervalByLocalDate(crossing, "Asia/Shanghai")).toEqual({
      "2026-08-14": 30 * 60_000,
      "2026-08-15": 30 * 60_000,
    });
  });

  it("按会话时区统计指定本地日期，并按任务累计跨午夜时长", () => {
    const crossing = interval({ sessionId: "session-1", startedAt: "2026-08-14T15:30:00.000Z", endedAt: "2026-08-14T16:30:00.000Z" });
    const session = {
      id: "session-1", taskId: "task-1", timezone: "Asia/Shanghai",
    } as StudySession;
    expect(sessionFocusSecondsOnLocalDate(session, [crossing], "2026-08-15")).toBe(30 * 60);
    expect(taskFocusSecondsOnLocalDate([session], [crossing], "2026-08-15")).toEqual({ "task-1": 30 * 60 });
  });

  it("跨午夜拆分保持毫秒精度，而不是按分钟近似", () => {
    const crossing = interval({
      startedAt: "2026-08-14T15:59:59.250Z",
      endedAt: "2026-08-14T16:00:00.750Z",
    });
    expect(splitIntervalByLocalDate(crossing, "Asia/Shanghai")).toEqual({
      "2026-08-14": 750,
      "2026-08-15": 750,
    });
  });
});
