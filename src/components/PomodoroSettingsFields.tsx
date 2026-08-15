import type { PomodoroSettingsSnapshot } from "../../shared/schemas/models";

export function PomodoroSettingsFields({ value, onChange, prefix = "本次" }: {
  value: PomodoroSettingsSnapshot;
  onChange: (value: PomodoroSettingsSnapshot) => void;
  prefix?: string;
}) {
  function update(key: keyof PomodoroSettingsSnapshot, raw: string) {
    onChange({ ...value, [key]: Number(raw) });
  }
  return <div className="pomodoro-fields">
    <label className="field">{prefix}专注时长（分钟）<input aria-label={`${prefix}专注时长`} type="number" min="1" max="180" required value={value.focusMinutes} onChange={(event) => update("focusMinutes", event.target.value)} /></label>
    <label className="field">短休息（分钟）<input aria-label={`${prefix}短休息`} type="number" min="1" max="60" required value={value.shortBreakMinutes} onChange={(event) => update("shortBreakMinutes", event.target.value)} /></label>
    <label className="field">长休息（分钟）<input aria-label={`${prefix}长休息`} type="number" min="1" max="120" required value={value.longBreakMinutes} onChange={(event) => update("longBreakMinutes", event.target.value)} /></label>
    <label className="field">每组轮数<input aria-label={`${prefix}每组轮数`} type="number" min="1" max="12" required value={value.roundsPerSet} onChange={(event) => update("roundsPerSet", event.target.value)} /></label>
  </div>;
}
