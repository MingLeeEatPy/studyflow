import { useEffect, useState, type FormEvent } from "react";
import { AMBIENT_SOUNDS, COMPLETION_SOUNDS, type AmbientSound } from "../features/focusAudio";
import type { ExecutionSettings } from "../features/executionTypes";

type Props = {
  settings: ExecutionSettings | null;
  onSave: (value: Partial<ExecutionSettings>) => Promise<void>;
  onPreviewCompletionSound: (value: Pick<ExecutionSettings, "completionSound" | "ambientSound" | "soundVolume">) => void;
  onPreviewAmbientSound: (sound: AmbientSound, volume: number) => void;
};

export function ExecutionSettingsPage({ settings, onSave, onPreviewCompletionSound, onPreviewAmbientSound }: Props) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);
  if (!draft) return <p>正在读取设置…</p>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = draft;
    if (!value) return;
    setSaving(true);
    setSaved(false);
    try {
      await onSave(value);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <header className="page-header"><div><p className="eyebrow">Execution</p><h1>专注设置</h1><p>调整番茄节奏、自然环境声与阶段结束提醒。更改只影响之后开始的会话。</p></div></header>
    <form className="settings-panel" onSubmit={(event) => void submit(event)}>
      <section><div><h2>番茄钟</h2><p>设置一组专注与休息的节奏。</p></div><div className="settings-grid">
        <NumberField label="专注时长" value={draft.focusMinutes} min={1} max={180} onChange={(focusMinutes) => setDraft({ ...draft, focusMinutes })} />
        <NumberField label="短休息" value={draft.shortBreakMinutes} min={1} max={60} onChange={(shortBreakMinutes) => setDraft({ ...draft, shortBreakMinutes })} />
        <NumberField label="长休息" value={draft.longBreakMinutes} min={1} max={120} onChange={(longBreakMinutes) => setDraft({ ...draft, longBreakMinutes })} />
        <NumberField label="每组轮数" unit="轮" value={draft.roundsPerSet} min={1} max={12} onChange={(roundsPerSet) => setDraft({ ...draft, roundsPerSet })} />
      </div></section>
      <section><div><h2>专注声音</h2><p>环境音仅在正在专注时播放；暂停、休息和结束时会暂停。</p></div><div className="settings-grid">
        <label className="field"><span>环境音</span><select value={draft.ambientSound} onChange={(event) => setDraft({ ...draft, ambientSound: event.target.value as AmbientSound })}>
          {Object.entries(AMBIENT_SOUNDS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
        </select></label>
        <div className={`volume-setting${draft.ambientSound === "off" ? " disabled" : ""}`}><label htmlFor="ambient-volume"><span><strong>环境音音量</strong><small>与阶段结束提示音分开保存</small></span><output>{draft.ambientVolume}%</output></label>
          <input id="ambient-volume" aria-label="环境音音量" type="range" min="10" max="100" step="5" disabled={draft.ambientSound === "off"} value={draft.ambientVolume} onChange={(event) => setDraft({ ...draft, ambientVolume: Number(event.target.value) })} />
          <button className="button secondary" type="button" disabled={draft.ambientSound === "off"} onClick={() => onPreviewAmbientSound(draft.ambientSound, draft.ambientVolume)}>试听环境音</button>
        </div>
      </div></section>
      <section><div><h2>安全与提醒</h2><p>避免忘记停止计时，并选择阶段完成时的提醒方式。</p></div><div className="settings-grid">
        <NumberField label="正计时自动暂停" value={draft.stopwatchAutoPauseMinutes} min={60} max={1440} onChange={(stopwatchAutoPauseMinutes) => setDraft({ ...draft, stopwatchAutoPauseMinutes })} />
        <label className="setting-switch"><span><strong>提示音</strong><small>阶段结束时播放所选提示音</small></span><input type="checkbox" checked={draft.soundEnabled} onChange={(event) => setDraft({ ...draft, soundEnabled: event.target.checked })} /></label>
        <label className={`field${draft.soundEnabled ? "" : " disabled"}`}><span>结束提示音</span><select disabled={!draft.soundEnabled} value={draft.completionSound} onChange={(event) => setDraft({ ...draft, completionSound: event.target.value as ExecutionSettings["completionSound"] })}>
          <option value="wind-chime">{COMPLETION_SOUNDS["wind-chime"].label}</option><option value="forest-birds">{COMPLETION_SOUNDS["forest-birds"].label}</option><option value="stream-flute">{COMPLETION_SOUNDS["stream-flute"].label}</option><option value="campfire-bell">{COMPLETION_SOUNDS["campfire-bell"].label}</option><option value="follow-ambience">随环境变化</option>
        </select></label>
        <div className={`volume-setting${draft.soundEnabled ? "" : " disabled"}`}><label htmlFor="sound-volume"><span><strong>提示音音量</strong><small>拖动后可立即试听</small></span><output>{draft.soundVolume}%</output></label>
          <input id="sound-volume" aria-label="提示音音量" type="range" min="10" max="100" step="5" disabled={!draft.soundEnabled} value={draft.soundVolume} onChange={(event) => setDraft({ ...draft, soundVolume: Number(event.target.value) })} />
          <button className="button secondary" type="button" disabled={!draft.soundEnabled} onClick={() => onPreviewCompletionSound(draft)}>试听提示音</button>
        </div>
        <label className="setting-switch"><span><strong>浏览器通知</strong><small>需要浏览器授予通知权限</small></span><input type="checkbox" checked={draft.notificationsEnabled} onChange={(event) => setDraft({ ...draft, notificationsEnabled: event.target.checked })} /></label>
      </div></section>
      <footer><span>{saved ? "设置已保存" : "所有声音设置仅保存在当前浏览器"}</span><button className="button primary" disabled={saving}>{saving ? "正在保存…" : "保存设置"}</button></footer>
    </form>
  </>;
}

function NumberField({ label, value, min, max, unit = "分钟", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="field"><span>{label}</span><div className="number-input"><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></div></label>;
}
