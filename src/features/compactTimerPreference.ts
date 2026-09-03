export type CompactTimerPosition = { x: number; y: number };
export type CompactTimerPreference = { enabled: boolean; side: "left" | "right"; position?: CompactTimerPosition };
export const COMPACT_TIMER_PREFERENCE_KEY = "studyflow:compact-timer";

export function loadCompactTimerPreference(): CompactTimerPreference {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPACT_TIMER_PREFERENCE_KEY) ?? "null") as Partial<CompactTimerPreference> | null;
    const position = Number.isFinite(stored?.position?.x) && Number.isFinite(stored?.position?.y)
      ? { x: Number(stored?.position?.x), y: Number(stored?.position?.y) }
      : undefined;
    const preference = { enabled: stored?.enabled === true, side: stored?.side === "left" ? "left" : "right" } as CompactTimerPreference;
    return position ? { ...preference, position } : preference;
  } catch {
    return { enabled: false, side: "right" };
  }
}

export function saveCompactTimerPreference(preference: CompactTimerPreference): void {
  localStorage.setItem(COMPACT_TIMER_PREFERENCE_KEY, JSON.stringify(preference));
}
