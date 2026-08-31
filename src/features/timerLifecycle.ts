import type { MeditationInterval, MeditationSession, StudyInterval, StudySession } from "../../shared/schemas/models";
import { intervalActiveMs } from "../domain/execution";
import { meditationEffectiveMs } from "../domain/meditation";

export type TimerDeadline = {
  sessionId: string;
  intervalId: string;
  revision: number;
  kind: "focus" | "break" | "meditation";
  dueAt: string;
};

export type HeartbeatSample = {
  previousWall: number;
  currentWall: number;
  previousMonotonic: number;
  currentMonotonic: number;
  wasHidden: boolean;
};

export function deriveStudyDeadline(
  session: StudySession,
  interval: StudyInterval | undefined,
  now: number,
): TimerDeadline | null {
  if (session.status !== "running" || !interval || interval.endedAt || !interval.targetSeconds) return null;
  const remainingMs = Math.max(0, interval.targetSeconds * 1000 - intervalActiveMs(interval, new Date(now).toISOString()));
  return {
    sessionId: session.id,
    intervalId: interval.id,
    revision: session.revision,
    kind: interval.kind,
    dueAt: new Date(now + remainingMs).toISOString(),
  };
}

export function deriveMeditationDeadline(
  session: MeditationSession,
  interval: MeditationInterval | undefined,
  now: number,
): TimerDeadline | null {
  if (session.status !== "running" || !interval || interval.kind !== "meditation" || interval.endedAt || !interval.targetSeconds) return null;
  const remainingMs = Math.max(0, interval.targetSeconds * 1000 - meditationEffectiveMs(interval, new Date(now).toISOString()));
  return {
    sessionId: session.id,
    intervalId: interval.id,
    revision: session.revision,
    kind: "meditation",
    dueAt: new Date(now + remainingMs).toISOString(),
  };
}

export function isVisibleClockJump(sample: HeartbeatSample): boolean {
  if (sample.wasHidden) return false;
  const wallElapsed = sample.currentWall - sample.previousWall;
  const monotonicElapsed = sample.currentMonotonic - sample.previousMonotonic;
  return wallElapsed > 15_000 || Math.abs(wallElapsed - monotonicElapsed) > 15_000;
}
