import { ArrowLeft, Coffee, Pause, Play, Settings2, Square } from "lucide-react";
import type { ExecutionSettings, StudyInterval, StudySession } from "../features/executionTypes";
import { formatDuration } from "../features/executionAdapter";

export function FocusPage({ session, activeInterval, settings, seconds, estimateReached, onLeave, onPause, onResume, onAdvance, onEditPomodoro, onFinish }: { session: StudySession; activeInterval?: StudyInterval; settings: ExecutionSettings | null; seconds: number; estimateReached?: boolean; onLeave: () => void; onPause: () => void; onResume: () => void; onAdvance: (action: "start-break" | "skip-break" | "start-focus") => void; onEditPomodoro: () => void; onFinish: () => void }) {
  const paused = session.status === "paused"; const awaiting = session.status === "awaiting-confirmation";
  const isBreak = activeInterval?.kind === "break";
  const setComplete = isBreak && session.pomodoroRound % (session.pomodoroSettingsSnapshot?.roundsPerSet ?? settings?.roundsPerSet ?? 4) === 0;
  const target = activeInterval?.targetSeconds ? Math.round(activeInterval.targetSeconds / 60) : session.mode === "pomodoro" ? (isBreak ? settings?.shortBreakMinutes : settings?.focusMinutes) : session.estimatedMinutesSnapshot;
  return <main className="focus-page">
<header>
<button className="focus-back" onClick={onLeave}>
<ArrowLeft />返回 StudyFlow</button>
<span>{session.mode === "pomodoro" ? `POMODORO · ROUND ${session.pomodoroRound}` : "STOPWATCH"}</span>
</header>
<section className="focus-center">
<div className={`focus-orbit${paused ? " paused" : ""}`}>
<div>
<span>{isBreak ? awaiting ? "休息结束" : paused ? "休息已暂停" : "休息" : awaiting ? "本阶段完成" : paused ? "已暂停" : "正在专注"}</span>
<time>{formatDuration(seconds)}</time>{target && <small>目标 {target} 分钟</small>}</div>
</div>
<p className="focus-category">{session.categoryNameSnapshot}</p>
<h1>{session.taskTitleSnapshot}</h1>{session.goal && <p className="focus-goal">本次目标：{session.goal}</p>}{estimateReached&&<p className="focus-milestone">已达到任务预计时长，计时会继续进行</p>}<div className="focus-actions">{awaiting ? isBreak ? <button className="button focus-primary" onClick={() => onAdvance("start-focus")}>
<Play />{setComplete ? "继续下一组" : "开始下一轮"}</button> : <>
<button className="button focus-primary" onClick={() => onAdvance("start-break")}>
<Coffee />开始休息</button>
<button className="button focus-secondary" onClick={() => onAdvance("skip-break")}>跳过休息</button>
</> : <><button className="button focus-primary" onClick={paused ? onResume : onPause}>{paused ? <Play /> : <Pause />}{paused ? "继续" : "暂停"}</button>{isBreak&&!paused&&<button className="button focus-secondary" onClick={()=>onAdvance("skip-break")}>跳过休息</button>}</>}<button className="button focus-secondary" onClick={onFinish}>
<Square />结束学习</button>
</div>{session.mode === "pomodoro" && <button className="focus-settings" onClick={onEditPomodoro}><Settings2 />调整本次番茄设置</button>}
</section>
<footer>
<span>离开 Focus 页面不会停止计时</span>
<span>暂停和休息时间不会计入实际学习时长</span>
</footer>
</main>;
}
