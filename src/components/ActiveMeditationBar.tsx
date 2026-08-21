import { Flower2, Maximize2, Pause, Play, Square } from "lucide-react";
import type { MeditationSession } from "../../shared/schemas/models";
import { formatDuration } from "../features/executionAdapter";

export function ActiveMeditationBar({ session, seconds, onFocus, onPause, onResume, onFinish }: { session: MeditationSession; seconds: number; onFocus: () => void; onPause: () => void; onResume: () => void; onFinish: () => void }) {
  const paused = session.status === "paused"; const breathing = session.status === "breathing";
  return <aside className="active-session-bar active-meditation-bar" aria-label="正在进行的冥想"><button className="session-summary" aria-label="打开当前冥想" onClick={onFocus}><Flower2/><span><strong>{breathing ? "呼吸引导" : "Meditation"}</strong><small>{breathing ? "准备进入冥想" : session.mode === "timed" ? "定时冥想" : "自由冥想"}</small></span></button><time>{formatDuration(seconds)}</time><div>{!breathing && (session.status === "running" || paused) && <button aria-label={paused ? "继续冥想" : "暂停冥想"} onClick={paused ? onResume : onPause}>{paused ? <Play/> : <Pause/>}</button>}<button aria-label="回到 Meditation" onClick={onFocus}><Maximize2/></button><button aria-label="结束冥想" onClick={onFinish}><Square/></button></div></aside>;
}
