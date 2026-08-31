export type CompactTimerPreference = { enabled: boolean; side: "left" | "right" };
export const COMPACT_TIMER_PREFERENCE_KEY = "studyflow:compact-timer";

export function loadCompactTimerPreference(): CompactTimerPreference {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPACT_TIMER_PREFERENCE_KEY) ?? "null") as Partial<CompactTimerPreference> | null;
    return { enabled: stored?.enabled === true, side: stored?.side === "left" ? "left" : "right" };
  } catch {
    return { enabled: false, side: "right" };
  }
}

export function saveCompactTimerPreference(preference: CompactTimerPreference): void {
  localStorage.setItem(COMPACT_TIMER_PREFERENCE_KEY, JSON.stringify(preference));
}
