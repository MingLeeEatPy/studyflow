import { ArrowLeft, Coffee, Minimize2, Pause, Play, Settings2, Square } from "lucide-react";
import type { ExecutionSettings, StudyInterval, StudySession } from "../features/executionTypes";
import { formatDuration } from "../features/executionAdapter";
import { PlantIllustration } from "../components/PlantIllustration";
import type { GrowthStage } from "../domain/growth";

export function FocusPage({ session, activeInterval, settings, seconds, growthStage, growthVariant, overtime = false, estimateReached, onLeave, onCompact, onPause, onResume, onAdvance, onEditPomodoro, onFinish }: { session: StudySession; activeInterval?: StudyInterval; settings: ExecutionSettings | null; seconds: number; growthStage: GrowthStage; growthVariant: number; overtime?: boolean; estimateReached?: boolean; onLeave: () => void; onCompact: () => void; onPause: () => void; onResume: () => void; onAdvance: (action: "start-break" | "skip-break" | "start-focus") => void; onEditPomodoro: () => void; onFinish: () => void }) {
  const paused = session.status === "paused"; const awaiting = session.status === "awaiting-confirmation";
  const isBreak = activeInterval?.kind === "break";
  const singlePomodoro = session.mode === "pomodoro" && session.pomodoroPattern === "single";
  const setComplete = isBreak && session.pomodoroRound % (session.pomodoroSettingsSnapshot?.roundsPerSet ?? settings?.roundsPerSet ?? 4) === 0;
  const target = activeInterval?.targetSeconds ? Math.round(activeInterval.targetSeconds / 60) : session.mode === "pomodoro" ? (isBreak ? settings?.shortBreakMinutes : settings?.focusMinutes) : session.estimatedMinutesSnapshot;
  const targetSeconds = activeInterval?.targetSeconds ?? (target ? target * 60 : 0);
  const elapsedSeconds = overtime ? targetSeconds : session.mode === "pomodoro" && targetSeconds ? Math.max(0, targetSeconds - seconds) : seconds;
  const progress = targetSeconds ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100)) : 0;
  return <main className="focus-page">
<header>
<button className="focus-back" aria-label="返回 StudyFlow" onClick={onLeave}>
<ArrowLeft /><span>返回 StudyFlow</span></button>
<span>StudyFlow · Focus</span>
<div className="focus-header-actions"><span>{session.mode === "pomodoro" ? singlePomodoro ? "POMODORO · SINGLE" : `POMODORO · ROUND ${session.pomodoroRound}` : "STOPWATCH"}</span><button className="focus-compact-button" aria-label="缩小计时器" onClick={onCompact}><Minimize2 /></button></div>
</header>
<section className="focus-center">
<div className="focus-ambient" aria-hidden="true" />
<div className={`focus-botanical${paused ? " paused" : ""}${overtime ? " overtime" : ""}`} aria-hidden="true"><PlantIllustration kind="tree" stage={growthStage} variant={growthVariant} overtime={overtime}/></div>
<div className="focus-glass-panel">
<div className="focus-panel-meta"><span>{isBreak ? "休息阶段" : session.mode === "pomodoro" ? singlePomodoro ? "单轮专注" : `第 ${session.pomodoroRound} 轮` : "自由专注"}</span><span>{session.categoryNameSnapshot}</span></div>
<h1>{session.taskTitleSnapshot}</h1>
<div className={`focus-orbit${paused ? " paused" : ""}${overtime ? " overtime" : ""}`}>
<div>
<span>{isBreak ? awaiting ? "休息结束" : paused ? "休息已暂停" : "休息" : overtime ? "超时专注 · 正计时" : awaiting ? "本阶段完成" : paused ? "已暂停" : "正在专注"}</span>
<time>{formatDuration(seconds)}</time>{target && <small>目标 {target} 分钟</small>}</div>
</div>
{targetSeconds > 0 && <div className="focus-stage-progress" role="progressbar" aria-label={isBreak ? "当前休息阶段进度" : "当前专注阶段进度"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }}/></div>}
{session.goal && <p className="focus-goal">本次目标：{session.goal}</p>}{estimateReached&&<p className="focus-milestone">已达到任务预计时长，计时会继续进行</p>}<div className="focus-actions">{awaiting ? isBreak ? singlePomodoro ? <button className="button focus-primary" onClick={onFinish}><Square />结束学习</button> : <button className="button focus-primary" onClick={() => onAdvance("start-focus")}>
<Play />{setComplete ? "继续下一组" : "开始下一轮"}</button> : <>
<button className="button focus-primary" onClick={() => onAdvance("start-break")}>
<Coffee />{singlePomodoro ? "休息一次" : "开始休息"}</button>
{!singlePomodoro && <button className="button focus-secondary" onClick={() => onAdvance("skip-break")}>跳过休息</button>}
</> : <><button className="button focus-primary" onClick={paused ? onResume : onPause}>{paused ? <Play /> : <Pause />}{paused ? "继续" : "暂停"}</button>{isBreak&&!paused&&!singlePomodoro&&<button className="button focus-secondary" onClick={()=>onAdvance("skip-break")}>跳过休息</button>}</>}<button className="button focus-secondary" onClick={onFinish}>
<Square />结束学习</button>
</div>{session.mode === "pomodoro" && !singlePomodoro && <button className="focus-settings" onClick={onEditPomodoro}><Settings2 />调整本次番茄设置</button>}</div>
</section>
<footer>
<span>离开 Focus 页面不会停止计时</span>
<span>暂停和休息时间不会计入实际学习时长</span>
</footer>
</main>;
}
