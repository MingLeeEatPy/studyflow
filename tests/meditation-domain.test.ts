import { describe, expect, it } from "vitest";
import type { MeditationInterval } from "../shared/schemas/models";
import {
  breathingGuide,
  currentBreathingStep,
  meditationEffectiveMs,
  totalMeditationMs,
} from "../src/domain/meditation";

function interval(overrides: Partial<MeditationInterval> = {}): MeditationInterval {
  return {
    id: "meditation-interval",
    sessionId: "meditation-session",
    kind: "meditation",
    targetSeconds: null,
    startedAt: "2026-08-14T00:00:00.000Z",
    endedAt: "2026-08-14T00:02:00.000Z",
    pauses: [],
    sleepGaps: [],
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:02:00.000Z",
    ...overrides,
  };
}

describe("Meditation 呼吸引导与有效时长", () => {
  it("为 4-7-8、均衡和箱式呼吸生成固定轮次与总时长", () => {
    expect(breathingGuide("4-7-8")).toEqual({
      rounds: 4,
      steps: [
        { label: "吸气", seconds: 4 },
        { label: "屏息", seconds: 7 },
        { label: "呼气", seconds: 8 },
      ],
      totalSeconds: 76,
    });
    expect(breathingGuide("balanced")).toEqual({
      rounds: 8,
      steps: [{ label: "吸气", seconds: 4 }, { label: "呼气", seconds: 4 }],
      totalSeconds: 64,
    });
    expect(breathingGuide("box")).toEqual({
      rounds: 4,
      steps: [
        { label: "吸气", seconds: 4 },
        { label: "屏息", seconds: 4 },
        { label: "呼气", seconds: 4 },
        { label: "停留", seconds: 4 },
      ],
      totalSeconds: 64,
    });
    expect(breathingGuide("none")).toBeNull();
  });

  it("按秒定位当前呼吸步骤、剩余秒数和轮次，并在末尾稳定停留", () => {
    expect(currentBreathingStep("4-7-8", 0)).toEqual({ label: "吸气", round: 1, remaining: 4 });
    expect(currentBreathingStep("4-7-8", 4)).toEqual({ label: "屏息", round: 1, remaining: 7 });
    expect(currentBreathingStep("4-7-8", 11)).toEqual({ label: "呼气", round: 1, remaining: 8 });
    expect(currentBreathingStep("4-7-8", 19)).toEqual({ label: "吸气", round: 2, remaining: 4 });
    expect(currentBreathingStep("4-7-8", 76)).toEqual({ label: "呼气", round: 4, remaining: 1 });
    expect(currentBreathingStep("none", 10)).toBeNull();
  });

  it("呼吸阶段不计入冥想，暂停和排除的休眠时间从核心时长扣除", () => {
    const breathing = interval({ id: "breathing", kind: "breathing" });
    const meditation = interval({
      pauses: [{ startedAt: "2026-08-14T00:00:20.000Z", endedAt: "2026-08-14T00:00:40.000Z" }],
      sleepGaps: [{
        detectedAt: "2026-08-14T00:02:00.000Z",
        from: "2026-08-14T00:01:00.000Z",
        to: "2026-08-14T00:01:30.000Z",
        resolution: "exclude",
        correctedSeconds: null,
        resumeStatus: "running",
      }],
    });

    expect(meditationEffectiveMs(breathing)).toBe(0);
    expect(meditationEffectiveMs(meditation)).toBe(70_000);
    expect(totalMeditationMs([breathing, meditation])).toBe(70_000);
  });

  it("修正休眠时间只保留用户确认的有效秒数", () => {
    const meditation = interval({
      sleepGaps: [{
        detectedAt: "2026-08-14T00:02:00.000Z",
        from: "2026-08-14T00:00:30.000Z",
        to: "2026-08-14T00:01:30.000Z",
        resolution: "correct",
        correctedSeconds: 15,
        resumeStatus: "running",
      }],
    });
    expect(meditationEffectiveMs(meditation)).toBe(75_000);
  });
});
