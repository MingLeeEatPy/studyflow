import { useState, type FormEvent } from "react";
import { Flower2, Play, Wind } from "lucide-react";
import type { BreathingPattern, MeditationIntention, MeditationSession, StartMeditationInput } from "../../shared/schemas/models";
import { PlantIllustration } from "../components/PlantIllustration";
import { formatDuration } from "../features/executionAdapter";

const intentions: Array<[MeditationIntention, string]> = [["calm", "平静"], ["refocus", "恢复专注"], ["observe", "观察情绪"], ["self-care", "自我关怀"], ["rest", "休息"], ["other", "其他"]];
const breathingOptions: Array<[BreathingPattern, string]> = [["4-7-8", "4-7-8 · 4 轮"], ["balanced", "均衡呼吸 4-4 · 8 轮"], ["box", "箱式呼吸 · 4 轮"], ["none", "不使用呼吸引导"]];

export function MeditationPage({ history, durations, onStart }: { history: MeditationSession[]; durations: Record<string, number>; onStart: (input: StartMeditationInput) => Promise<void> }) {
  const [mode, setMode] = useState<"timed" | "free">("timed");
  const [minutes, setMinutes] = useState(10);
  const [intention, setIntention] = useState<MeditationIntention>("calm");
  const [intentionNote, setIntentionNote] = useState("");
  const [breathingPattern, setBreathingPattern] = useState<BreathingPattern>("4-7-8");
  const [busy, setBusy] = useState(false);
  const recent = history.slice(0, 4);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await onStart({ mode, targetMinutes: mode === "timed" ? minutes : null, intention, intentionNote, breathingPattern, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }
    finally { setBusy(false); }
  }
  return <>
    <header className="page-header nature-page-header"><div><p className="eyebrow">Meditation</p><h1>风恬浪静中，见人生之真境；味淡声希处，识心体之本然。</h1><p>不追求表现，只练习回到此刻。</p></div></header>
    <section className="meditation-entry">
      <div className="meditation-entry-art" aria-hidden="true"><PlantIllustration kind="flower" stage={4} variant={1}/></div>
      <form className="meditation-start-card" onSubmit={(event) => void submit(event)}>
        <header><span><Flower2/>开始冥想</span><small>呼吸引导不会计入核心冥想时长</small></header>
        <fieldset className="meditation-mode"><legend>计时方式</legend><label className={mode === "timed" ? "selected" : ""}><input type="radio" checked={mode === "timed"} onChange={() => setMode("timed")}/>定时冥想</label><label className={mode === "free" ? "selected" : ""}><input type="radio" checked={mode === "free"} onChange={() => setMode("free")}/>自由计时</label></fieldset>
        {mode === "timed" && <div className="meditation-presets" aria-label="冥想时长">{[5,10,15,20,30].map(value => <button type="button" className={minutes === value ? "active" : ""} key={value} onClick={() => setMinutes(value)}>{value} 分钟</button>)}<label>自定义<input aria-label="自定义冥想分钟" type="number" min="1" max="180" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}/></label></div>}
        <div className="meditation-fields"><label className="field">本次意图<select aria-label="冥想意图" value={intention} onChange={(event) => setIntention(event.target.value as MeditationIntention)}>{intentions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field">呼吸引导<select aria-label="呼吸引导" value={breathingPattern} onChange={(event) => setBreathingPattern(event.target.value as BreathingPattern)}>{breathingOptions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
        {intention === "other" && <label className="field">意图说明<input value={intentionNote} maxLength={200} onChange={(event) => setIntentionNote(event.target.value)}/></label>}
        <button className="button primary meditation-start-button" disabled={busy}><Play/>{busy ? "正在准备…" : "进入 Meditation"}</button>
      </form>
    </section>
    <section className="meditation-recent"><header><div><h2>近期冥想</h2><p>冥想时长与学习专注分开记录。</p></div><Wind/></header>{recent.length ? <div>{recent.map((session) => <article key={session.id}><span>{new Intl.DateTimeFormat("zh-CN", { timeZone: session.timezone, month: "numeric", day: "numeric" }).format(new Date(session.startedAt))}</span><strong>{intentions.find(([value]) => value === session.intention)?.[1]}</strong><time>{formatDuration(durations[session.id] ?? 0)}</time>{session.feeling && <small>感受 {session.feeling}/5</small>}</article>)}</div> : <p className="meditation-empty">完成第一次至少 1 分钟的冥想后，记录会出现在这里。</p>}</section>
  </>;
}
