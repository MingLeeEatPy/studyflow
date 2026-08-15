import { Maximize2, Pause, Play, Square } from "lucide-react";
import type { StudySession } from "../features/executionTypes";
import { formatDuration } from "../features/executionAdapter";

export function ActiveSessionBar({ session, seconds, onFocus, onPause, onResume, onFinish }: { session: StudySession; seconds: number; onFocus: () => void; onPause: () => void; onResume: () => void; onFinish: () => void }) {
  const paused = session.status === "paused";
  const canToggle = session.status === "running" || paused;
  return <aside className="active-session-bar" aria-label="正在进行的学习">
    <button className="session-summary" onClick={onFocus}><span className={`pulse-dot${paused ? " paused" : ""}`} /><span><strong>{session.taskTitleSnapshot}</strong><small>{session.mode === "pomodoro" ? `番茄钟 · 第 ${session.pomodoroRound || 1} 轮` : "正计时"}</small></span></button>
    <time>{formatDuration(seconds)}</time>
    <div>{canToggle && <button title={paused ? "继续" : "暂停"} aria-label={paused ? "继续计时" : "暂停计时"} onClick={paused ? onResume : onPause}>{paused ? <Play /> : <Pause />}</button>}<button title="回到 Focus" aria-label="回到 Focus" onClick={onFocus}><Maximize2 /></button><button title="结束" aria-label="结束学习" onClick={onFinish}><Square /></button></div>
  </aside>;
}
