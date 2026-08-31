import { describe, expect, it } from "vitest";
import type { MeditationInterval, MeditationSession, StudyInterval, StudySession } from "../shared/schemas/models";
import { deriveMeditationDeadline, deriveStudyDeadline, isVisibleClockJump } from "../src/features/timerLifecycle";

const now = Date.parse("2026-08-31T08:10:00.000Z");
const interval = {
  id: "interval-1", sessionId: "session-1", kind: "focus", targetSeconds: 900,
  pomodoroRound: 1,
  startedAt: "2026-08-31T08:00:00.000Z", endedAt: null, pauses: [], sleepGaps: [],
  createdAt: "2026-08-31T08:00:00.000Z", updatedAt: "2026-08-31T08:00:00.000Z",
} satisfies StudyInterval;
const session = { id: "session-1", status: "running", revision: 3 } as StudySession;

describe("timer lifecycle", () => {
  it("derives a study deadline from effective elapsed time", () => {
    expect(deriveStudyDeadline(session, interval, now)?.dueAt).toBe("2026-08-31T08:15:00.000Z");
  });

  it("moves the deadline after a pause", () => {
    const pausedInterval = { ...interval, pauses: [{ startedAt: "2026-08-31T08:04:00.000Z", endedAt: "2026-08-31T08:06:00.000Z" }] };
    expect(deriveStudyDeadline(session, pausedInterval, now)?.dueAt).toBe("2026-08-31T08:17:00.000Z");
  });

  it("does not schedule paused or untimed phases", () => {
    expect(deriveStudyDeadline({ ...session, status: "paused" }, interval, now)).toBeNull();
    expect(deriveStudyDeadline(session, { ...interval, targetSeconds: null }, now)).toBeNull();
  });

  it("uses the same deadline rule for timed meditation", () => {
    const meditationInterval = { ...interval, kind: "meditation", targetSeconds: 1200 } as MeditationInterval;
    const meditationSession = { id: "session-1", status: "running", revision: 4 } as MeditationSession;
    expect(deriveMeditationDeadline(meditationSession, meditationInterval, now)?.dueAt).toBe("2026-08-31T08:20:00.000Z");
  });

  it("ignores suspension while hidden but detects a visible clock jump", () => {
    const base = { previousWall: 0, currentWall: 60_000, previousMonotonic: 0, currentMonotonic: 1_000 };
    expect(isVisibleClockJump({ ...base, wasHidden: true })).toBe(false);
    expect(isVisibleClockJump({ ...base, wasHidden: false })).toBe(true);
  });
});
