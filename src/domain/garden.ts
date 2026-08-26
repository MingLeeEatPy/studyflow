import type { MeditationSession, StudySession, GrowthRecord } from "../../shared/schemas/models";
import { calculateGrowthStage, type GrowthStage } from "./growth";

export interface GardenEntry {
  record: GrowthRecord;
  localDate: string;
  title: string;
  subtitle: string;
  durationSeconds: number;
  stage: GrowthStage;
}

const meditationTitles: Record<MeditationSession["intention"], string> = {
  calm: "平静",
  refocus: "恢复专注",
  observe: "观察情绪",
  "self-care": "自我关怀",
  rest: "休息",
  other: "自由冥想",
};

export function buildGardenEntries(
  records: GrowthRecord[],
  studySessions: StudySession[],
  studyDurations: Record<string, number>,
  meditationSessions: MeditationSession[],
  meditationDurations: Record<string, number>,
): GardenEntry[] {
  const studies = new Map(studySessions.map((session) => [session.id, session]));
  const meditations = new Map(meditationSessions.map((session) => [session.id, session]));
  return records.flatMap((record) => {
    if (record.sourceType === "study") {
      const session = studies.get(record.sourceSessionId);
      if (!session) return [];
      const durationSeconds = studyDurations[session.id] ?? 0;
      return [{ record, localDate: record.localDate, title: session.taskTitleSnapshot, subtitle: session.categoryNameSnapshot,
        durationSeconds, stage: calculateGrowthStage(durationSeconds, record.targetSecondsSnapshot) }];
    }
    const session = meditations.get(record.sourceSessionId);
    if (!session) return [];
    const durationSeconds = meditationDurations[session.id] ?? 0;
    return [{ record, localDate: record.localDate, title: meditationTitles[session.intention], subtitle: "Meditation",
      durationSeconds, stage: calculateGrowthStage(durationSeconds, record.targetSecondsSnapshot) }];
  }).sort((left, right) => right.localDate.localeCompare(left.localDate) || right.record.createdAt.localeCompare(left.record.createdAt));
}
