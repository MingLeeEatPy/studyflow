import { ArrowLeft, Pause, Play, SkipForward, Square } from "lucide-react";
import type { MeditationSession } from "../../shared/schemas/models";
import { PlantIllustration } from "../components/PlantIllustration";
import type { GrowthStage } from "../domain/growth";
import { currentBreathingStep } from "../domain/meditation";
import { formatDuration } from "../features/executionAdapter";

const intentionLabels: Record<string,string> = { calm: "平静", refocus: "恢复专注", observe: "观察情绪", "self-care": "自我关怀", rest: "休息", other: "其他" };

export function MeditationFocusPage({ session, elapsedSeconds, phaseElapsedSeconds, growthStage, growthVariant, overtime, onLeave, onSkipBreathing, onPause, onResume, onFinish }: { session: MeditationSession; elapsedSeconds: number; phaseElapsedSeconds: number; growthStage: GrowthStage; growthVariant: number; overtime: boolean; onLeave: () => void; onSkipBreathing: () => void; onPause: () => void; onResume: () => void; onFinish: () => void }) {
  const breathing = session.status === "breathing";
  const paused = session.status === "paused";
  const step = breathing ? currentBreathingStep(session.breathingPattern, phaseElapsedSeconds) : null;
  const shownSeconds = breathing ? phaseElapsedSeconds : session.targetSeconds && !overtime ? Math.max(0, session.targetSeconds - elapsedSeconds) : overtime && session.targetSeconds ? elapsedSeconds - session.targetSeconds : elapsedSeconds;
  return <main className="meditation-focus-page">
    <div className="meditation-mist" aria-hidden="true"/>
    <header><button aria-label="返回 StudyFlow" onClick={onLeave}><ArrowLeft/></button><span>StudyFlow · Meditation</span><small>{intentionLabels[session.intention]}</small></header>
    <section className="meditation-focus-center">
      {breathing ? <div className={`breathing-orb step-${step?.label ?? "rest"}`}><span>{step?.label ?? "准备"}</span><strong>{step?.remaining ?? ""}</strong><small>第 {step?.round ?? 1} / {session.breathingRounds} 轮</small></div> : <div className="meditation-flower" aria-hidden="true"><PlantIllustration kind="flower" stage={growthStage} variant={growthVariant} overtime={overtime}/></div>}
      <div className="meditation-controls-glass"><span>{breathing ? "呼吸引导" : overtime ? "定时结束 · 正计时" : paused ? "冥想已暂停" : session.mode === "free" ? "自由冥想" : "正在冥想"}</span><time>{formatDuration(shownSeconds)}</time>{breathing ? <button className="button meditation-light" onClick={onSkipBreathing}><SkipForward/>跳过引导</button> : <div className="meditation-focus-actions"><button className="button meditation-light" onClick={paused ? onResume : onPause}>{paused ? <Play/> : <Pause/>}{paused ? "继续" : "暂停"}</button><button className="button meditation-quiet" onClick={onFinish}><Square/>结束冥想</button></div>}{breathing && <button className="meditation-end-link" onClick={onFinish}>结束本次冥想</button>}</div>
    </section>
    <footer><span>慢一点也没有关系</span><span>离开此页面不会停止计时</span></footer>
  </main>;
}
