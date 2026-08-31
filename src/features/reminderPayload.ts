export type StudyFlowPushPayload = {
  intervalId: string;
  revision: number;
  dueAt?: string;
  kind?: "focus" | "break" | "meditation";
};

export function parseStudyFlowPushPayload(value: unknown): StudyFlowPushPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StudyFlowPushPayload>;
  if (typeof candidate.intervalId !== "string" || !candidate.intervalId || !Number.isInteger(candidate.revision)) return null;
  if (candidate.kind && !["focus", "break", "meditation"].includes(candidate.kind)) return null;
  return candidate as StudyFlowPushPayload;
}

export function reminderNotification(payload: StudyFlowPushPayload): { body: string; tag: string; url: string } {
  const body = payload.kind === "break" ? "本轮休息时间已到" : payload.kind === "meditation" ? "本轮冥想时间已到" : "本轮专注时间已到";
  return { body, tag: `studyflow:${payload.intervalId}:${payload.revision}`, url: "./#focus" };
}
