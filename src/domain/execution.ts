import type { StudyInterval, StudySession } from "../../shared/schemas/models";

const ms = (value: string) => new Date(value).getTime();

export function intervalActiveMs(interval: StudyInterval, until = new Date().toISOString()): number {
  const start = ms(interval.startedAt);
  const end = ms(interval.endedAt ?? until);
  const total = Math.max(0, end - start);
  const excluded: Array<[number, number]> = interval.pauses.map((pause) => [ms(pause.startedAt), ms(pause.endedAt ?? until)]);
  for (const gap of interval.sleepGaps) {
    if (gap.resolution === "exclude") excluded.push([ms(gap.from), ms(gap.to)]);
    if (gap.resolution === "correct") {
      // correctedSeconds is the portion kept as effective time from the beginning of the gap.
      excluded.push([ms(gap.from) + (gap.correctedSeconds ?? 0) * 1000, ms(gap.to)]);
    }
  }
  const clipped = excluded
    .map(([from, to]): [number, number] => [Math.max(start, from), Math.min(end, to)])
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  let excludedMs = 0;
  let current: [number, number] | undefined;
  for (const range of clipped) {
    if (!current) current = [...range];
    else if (range[0] <= current[1]) current[1] = Math.max(current[1], range[1]);
    else { excludedMs += current[1] - current[0]; current = [...range]; }
  }
  if (current) excludedMs += current[1] - current[0];
  return Math.max(0, total - excludedMs);
}

export function intervalEffectiveMs(interval: StudyInterval, until = new Date().toISOString()): number {
  return interval.kind === "focus" ? intervalActiveMs(interval, until) : 0;
}

export function totalFocusMs(intervals: StudyInterval[], until?: string): number {
  return intervals.reduce((sum, interval) => sum + intervalEffectiveMs(interval, until), 0);
}

export function shouldAutoPause(interval: StudyInterval, limitMinutes: number, now: string): boolean {
  return interval.kind === "focus" && interval.endedAt === null && intervalEffectiveMs(interval, now) >= limitMinutes * 60_000;
}

export function hasUnresolvedSleepGap(intervals: StudyInterval[]): boolean {
  return intervals.some((interval) => interval.sleepGaps.some((gap) => gap.resolution === null));
}

export function splitIntervalByLocalDate(
  interval: StudyInterval,
  timezone: string,
  until = new Date().toISOString(),
): Record<string, number> {
  if (interval.kind !== "focus") return {};
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const localDateAt = (timestamp: number): string => {
    const parts = formatter.formatToParts(new Date(timestamp));
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${pick("year")}-${pick("month")}-${pick("day")}`;
  };
  const result: Record<string, number> = {};
  const end = ms(interval.endedAt ?? until);
  // A local calendar day is always much longer than six hours, including DST transitions.
  // Search the exact millisecond at which its label changes instead of approximating around midnight.
  for (let cursor = ms(interval.startedAt); cursor < end;) {
    const date = localDateAt(cursor);
    const probeEnd = Math.min(end, cursor + 6 * 60 * 60_000);
    let next = probeEnd;
    if (probeEnd > cursor && localDateAt(probeEnd - 1) !== date) {
      let low = cursor;
      let high = probeEnd;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (localDateAt(middle) === date) low = middle;
        else high = middle;
      }
      next = high;
    }
    const slice: StudyInterval = { ...interval, startedAt: new Date(cursor).toISOString(), endedAt: new Date(next).toISOString() };
    result[date] = (result[date] ?? 0) + intervalEffectiveMs(slice, until);
    cursor = next;
  }
  return result;
}

export function sessionFocusSecondsOnLocalDate(
  session: StudySession,
  intervals: StudyInterval[],
  localDate: string,
  until = new Date().toISOString(),
): number {
  const milliseconds = intervals
    .filter((interval) => interval.sessionId === session.id)
    .reduce((sum, interval) => sum + (splitIntervalByLocalDate(interval, session.timezone, until)[localDate] ?? 0), 0);
  return milliseconds / 1000;
}

export function taskFocusSecondsOnLocalDate(
  sessions: StudySession[],
  intervals: StudyInterval[],
  localDate: string,
  until = new Date().toISOString(),
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const session of sessions) {
    if (!session.taskId) continue;
    result[session.taskId] = (result[session.taskId] ?? 0)
      + sessionFocusSecondsOnLocalDate(session, intervals, localDate, until);
  }
  return result;
}
