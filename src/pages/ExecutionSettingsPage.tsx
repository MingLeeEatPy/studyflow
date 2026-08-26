import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AMBIENT_SOUNDS, COMPLETION_SOUNDS, type AmbientSound } from "../features/focusAudio";
import type { ExecutionSettings } from "../features/executionTypes";
import { authAdapter } from "../features/authAdapter";
import { confirmFirstMerge, createLocalBackup, prepareFirstMerge, syncNow, type MergeSummary, type SyncStatus } from "../features/syncService";

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
    event.preventDefault(); setSaving(true); setSaved(false);
    try { await onSave(draft as Partial<ExecutionSettings>); setSaved(true); } finally { setSaving(false); }
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
        <label className="field"><span>环境音</span><select value={draft.ambientSound} onChange={(event) => setDraft({ ...draft, ambientSound: event.target.value as AmbientSound })}>{Object.entries(AMBIENT_SOUNDS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select></label>
        <div className={`volume-setting${draft.ambientSound === "off" ? " disabled" : ""}`}><label htmlFor="ambient-volume"><span><strong>环境音音量</strong><small>与阶段结束提示音分开保存</small></span><output>{draft.ambientVolume}%</output></label><input id="ambient-volume" aria-label="环境音音量" type="range" min="10" max="100" step="5" disabled={draft.ambientSound === "off"} value={draft.ambientVolume} onChange={(event) => setDraft({ ...draft, ambientVolume: Number(event.target.value) })} /><button className="button secondary" type="button" disabled={draft.ambientSound === "off"} onClick={() => onPreviewAmbientSound(draft.ambientSound, draft.ambientVolume)}>试听环境音</button></div>
      </div></section>
      <section><div><h2>安全与提醒</h2><p>避免忘记停止计时，并选择阶段完成时的提醒方式。</p></div><div className="settings-grid">
        <NumberField label="正计时自动暂停" value={draft.stopwatchAutoPauseMinutes} min={60} max={1440} onChange={(stopwatchAutoPauseMinutes) => setDraft({ ...draft, stopwatchAutoPauseMinutes })} />
        <label className="setting-switch"><span><strong>提示音</strong><small>阶段结束时播放所选提示音</small></span><input type="checkbox" checked={draft.soundEnabled} onChange={(event) => setDraft({ ...draft, soundEnabled: event.target.checked })} /></label>
        <label className={`field${draft.soundEnabled ? "" : " disabled"}`}><span>结束提示音</span><select disabled={!draft.soundEnabled} value={draft.completionSound} onChange={(event) => setDraft({ ...draft, completionSound: event.target.value as ExecutionSettings["completionSound"] })}>{Object.entries(COMPLETION_SOUNDS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}<option value="follow-ambience">随环境变化</option></select></label>
        <div className={`volume-setting${draft.soundEnabled ? "" : " disabled"}`}><label htmlFor="sound-volume"><span><strong>提示音音量</strong><small>拖动后可立即试听</small></span><output>{draft.soundVolume}%</output></label><input id="sound-volume" aria-label="提示音音量" type="range" min="10" max="100" step="5" disabled={!draft.soundEnabled} value={draft.soundVolume} onChange={(event) => setDraft({ ...draft, soundVolume: Number(event.target.value) })} /><button className="button secondary" type="button" disabled={!draft.soundEnabled} onClick={() => onPreviewCompletionSound(draft)}>试听提示音</button></div>
        <label className="setting-switch"><span><strong>浏览器通知</strong><small>需要浏览器授予通知权限</small></span><input type="checkbox" checked={draft.notificationsEnabled} onChange={(event) => setDraft({ ...draft, notificationsEnabled: event.target.checked })} /></label>
      </div></section>
      <footer><span>{saved ? "设置已保存" : "所有声音设置仅保存在当前浏览器"}</span><button className="button primary" disabled={saving}>{saving ? "正在保存…" : "保存设置"}</button></footer>
    </form>
    <SyncSettings />
  </>;
}

function NumberField({ label, value, min, max, unit = "分钟", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="field"><span>{label}</span><div className="number-input"><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></div></label>;
}

function SyncSettings() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<{ email: string | null } | null>(null);
  const [status, setStatus] = useState<SyncStatus>(authAdapter.isConfigured() ? "signed-out" : "not-configured");
  const [message, setMessage] = useState("");
  const [mergeSummary, setMergeSummary] = useState<MergeSummary | null>(null);
  useEffect(() => { void authAdapter.handleCallback().then(async (next) => { setUser(next); if (next) { setStatus("synced"); try { setMergeSummary((await prepareFirstMerge()).summary); } catch (error) { setMessage(error instanceof Error ? error.message : "无法读取云端数据"); } } }).catch((error) => setMessage(error instanceof Error ? error.message : "登录失败")); }, []);
  const sendLink = useCallback(async () => { try { await authAdapter.signInWithMagicLink(email); setMessage("登录链接已发送，请检查邮箱"); } catch (error) { setMessage(error instanceof Error ? error.message : "发送失败"); } }, [email]);
  const sync = useCallback(async () => { setStatus("offline"); const result = await syncNow(); setStatus(result.status); setMessage(result.error ?? `已上传 ${result.uploaded} 条，下载 ${result.downloaded} 条`); }, []);
  const merge = useCallback(async (strategy: "keep-local" | "merge") => { setStatus("offline"); const result = await confirmFirstMerge(strategy); setStatus(result.status); setMergeSummary(null); setMessage(result.error ?? `合并完成：上传 ${result.uploaded} 条，下载 ${result.downloaded} 条`); }, []);
  const backup = useCallback(async () => { const blob = await createLocalBackup(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `studyflow-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); }, []);
  return <section className="settings-panel sync-settings"><header><div><p className="eyebrow">Cloud Sync</p><h2>跨设备同步</h2><p>登录后可在手机和电脑之间共享数据；未登录时仍只保存在当前设备。</p></div></header>{!authAdapter.isConfigured() ? <p className="inline-warning">尚未配置云同步服务，当前继续使用本地模式。</p> : user ? <div className="sync-actions"><p>已登录：{user.email ?? "邮箱用户"}</p>{mergeSummary && <div className="sync-merge"><strong>首次登录前请确认</strong><span>本地 {mergeSummary.localCount} 条，云端 {mergeSummary.remoteCount} 条</span><button className="button primary" type="button" onClick={() => void merge("merge")}>合并本地与云端</button><button className="button secondary" type="button" onClick={() => void merge("keep-local")}>只保留本地</button></div>}<button className="button secondary" type="button" onClick={() => void sync()}>立即同步</button><button className="button secondary" type="button" onClick={() => void backup()}>导出本地备份</button><button className="button secondary" type="button" onClick={() => { void authAdapter.signOut(); setUser(null); setStatus("signed-out"); }}>退出登录</button><small>状态：{status}</small></div> : <div className="sync-actions"><label className="field"><span>邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label><button className="button primary" type="button" disabled={!email} onClick={() => void sendLink()}>发送登录链接</button><button className="button secondary" type="button" onClick={() => void backup()}>先导出本地备份</button></div>}{message && <p role="status">{message}</p>}</section>;
}
