import { growthRecordSchema, type GrowthRecord, type MeditationSession, type StudySession } from "../../shared/schemas/models";

export type GrowthStage = 0 | 1 | 2 | 3 | 4;

export function growthStageFromRatio(ratio: number): GrowthStage {
  if (ratio >= 1) return 4;
  if (ratio >= 0.65) return 3;
  if (ratio >= 0.35) return 2;
  if (ratio >= 0.1) return 1;
  return 0;
}

export function calculateGrowthStage(effectiveSeconds: number, targetSeconds: number): GrowthStage {
  if (targetSeconds <= 0) return 0;
  return growthStageFromRatio(Math.max(0, effectiveSeconds) / targetSeconds);
}

export function studyGrowthTargetSeconds(session: StudySession): number {
  if (session.taskId && session.estimatedMinutesSnapshot) return session.estimatedMinutesSnapshot * 60;
  if (session.mode === "pomodoro" && session.pomodoroSettingsSnapshot) {
    return session.pomodoroSettingsSnapshot.focusMinutes * 60;
  }
  return 25 * 60;
}

export function meditationGrowthTargetSeconds(session: MeditationSession): number {
  return session.mode === "timed" && session.targetSeconds ? session.targetSeconds : 10 * 60;
}

export function stablePlantVariant(sourceSessionId: string): 0 | 1 | 2 {
  let hash = 2166136261;
  for (const character of sourceSessionId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 3) as 0 | 1 | 2;
}

export function localDateInTimezone(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function createStudyGrowthRecord(session: StudySession, id: string, completedAt: string): GrowthRecord {
  return growthRecordSchema.parse({
    id,
    sourceType: "study",
    sourceSessionId: session.id,
    plantType: "tree",
    variant: stablePlantVariant(session.id),
    targetSecondsSnapshot: studyGrowthTargetSeconds(session),
    localDate: localDateInTimezone(completedAt, session.timezone),
    timezone: session.timezone,
    createdAt: completedAt,
  });
}
