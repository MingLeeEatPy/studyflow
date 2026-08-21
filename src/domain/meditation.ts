import type { BreathingPattern, MeditationInterval } from "../../shared/schemas/models";
import { intervalActiveMs } from "./execution";

export interface BreathingStep { label: string; seconds: number }
export interface BreathingGuide { rounds: number; steps: BreathingStep[]; totalSeconds: number }

export function breathingGuide(pattern: BreathingPattern): BreathingGuide | null {
  const config = pattern === "4-7-8" ? { rounds: 4, steps: [{ label: "吸气", seconds: 4 }, { label: "屏息", seconds: 7 }, { label: "呼气", seconds: 8 }] }
    : pattern === "balanced" ? { rounds: 8, steps: [{ label: "吸气", seconds: 4 }, { label: "呼气", seconds: 4 }] }
      : pattern === "box" ? { rounds: 4, steps: [{ label: "吸气", seconds: 4 }, { label: "屏息", seconds: 4 }, { label: "呼气", seconds: 4 }, { label: "停留", seconds: 4 }] }
        : null;
  if (!config) return null;
  return { ...config, totalSeconds: config.rounds * config.steps.reduce((sum, step) => sum + step.seconds, 0) };
}

export function currentBreathingStep(pattern: BreathingPattern, elapsedSeconds: number): { label: string; round: number; remaining: number } | null {
  const guide = breathingGuide(pattern);
  if (!guide) return null;
  const cycleSeconds = guide.steps.reduce((sum, step) => sum + step.seconds, 0);
  const bounded = Math.min(Math.max(0, elapsedSeconds), Math.max(0, guide.totalSeconds - 1));
  const round = Math.floor(bounded / cycleSeconds) + 1;
  let position = bounded % cycleSeconds;
  for (const step of guide.steps) {
    if (position < step.seconds) return { label: step.label, round, remaining: step.seconds - Math.floor(position) };
    position -= step.seconds;
  }
  return null;
}

export function meditationEffectiveMs(interval: MeditationInterval, until?: string): number {
  return interval.kind === "meditation" ? intervalActiveMs(interval, until) : 0;
}

export function totalMeditationMs(intervals: MeditationInterval[], until?: string): number {
  return intervals.reduce((sum, interval) => sum + meditationEffectiveMs(interval, until), 0);
}
