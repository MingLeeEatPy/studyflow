import { Maximize2, Pause, Play, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { MeditationInterval, MeditationSession, StudyInterval, StudySession } from "../../shared/schemas/models";
import { intervalActiveMs, totalFocusMs } from "../domain/execution";
import { meditationEffectiveMs, totalMeditationMs } from "../domain/meditation";
import { formatDuration } from "../features/executionAdapter";
import { executionAdapter } from "../features/executionAdapter";
import { meditationAdapter } from "../features/meditationAdapter";
import { desktopBridge } from "./desktopBridge";
import "./desktopTimer.css";

type Snapshot = {
  study: StudySession | null;
  studyIntervals: StudyInterval[];
  meditation: MeditationSession | null;
  meditationIntervals: MeditationInterval[];
};

const emptySnapshot: Snapshot = { study: null, studyIntervals: [], meditation: null, meditationIntervals: [] };

export function DesktopTimerApp() {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const studyBoundaryRevision = useRef<number | null>(null);
  const meditationNoticeRevision = useRef<number | null>(null);
  const movePointer = useRef<{ pointerId: number; screenX: number; screenY: number } | null>(null);

  const refresh = useCallback(async () => {
    const [study, meditation] = await Promise.all([executionAdapter.getActive(), meditationAdapter.getActive()]);
    const [studyIntervals, meditationIntervals] = await Promise.all([
      study ? executionAdapter.listIntervals(study.id) : Promise.resolve([]),
      meditation ? meditationAdapter.listIntervals(meditation.id) : Promise.resolve([]),
    ]);
    setSnapshot({ study, studyIntervals, meditation: meditation ?? null, meditationIntervals });
  }, []);

  useEffect(() => {
    void refresh();
    const channel = new BroadcastChannel("studyflow-execution");
    channel.onmessage = () => void refresh();
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { channel.close(); window.clearInterval(timer); };
  }, [refresh]);

  // This window remains visible when the full StudyFlow window is hidden in the
  // tray. It owns only time-boundary reconciliation; all timestamps still come
  // from the shared persisted intervals rather than from a local counter.
  useEffect(() => {
    const study = snapshot.study;
    if (!study || study.status !== "running" || study.mode !== "pomodoro") return;
    const interval = snapshot.studyIntervals.find((item) => item.id === study.activeIntervalId);
    if (!interval?.targetSeconds || intervalActiveMs(interval, new Date(now).toISOString()) < interval.targetSeconds * 1_000) return;
    if (studyBoundaryRevision.current === study.revision) return;
    studyBoundaryRevision.current = study.revision;
    void executionAdapter.completeStage(study).then(() => {
      void desktopBridge.notify("StudyFlow", interval.kind === "focus" ? "本轮专注时间已到。" : "休息时间已到。");
      return refresh();
    });
  }, [now, refresh, snapshot.study, snapshot.studyIntervals]);

  useEffect(() => {
    const meditation = snapshot.meditation;
    if (!meditation || meditation.mode !== "timed" || meditation.status === "paused" || !meditation.targetSeconds) return;
    const elapsed = totalMeditationMs(snapshot.meditationIntervals, new Date(now).toISOString());
    if (elapsed < meditation.targetSeconds * 1_000 || meditationNoticeRevision.current === meditation.revision) return;
    meditationNoticeRevision.current = meditation.revision;
    void desktopBridge.notify("StudyFlow", "本轮冥想时间已到。");
  }, [now, snapshot.meditation, snapshot.meditationIntervals]);

  const state = useMemo(() => {
    if (snapshot.study) {
      const interval = snapshot.studyIntervals.find((item) => item.id === snapshot.study?.activeIntervalId);
      const focusSeconds = Math.floor(totalFocusMs(snapshot.studyIntervals, new Date(now).toISOString()) / 1000);
      const phaseSeconds = interval ? Math.floor(intervalActiveMs(interval, new Date(now).toISOString()) / 1000) : 0;
      const isPomodoro = snapshot.study.mode === "pomodoro" && Boolean(interval?.targetSeconds);
      const overtime = Boolean(snapshot.study.mode === "pomodoro" && snapshot.study.status === "awaiting-confirmation" && interval?.kind === "focus");
      const seconds = isPomodoro
        ? overtime ? Math.max(0, phaseSeconds - (interval?.targetSeconds ?? 0)) : Math.max(0, (interval?.targetSeconds ?? 0) - phaseSeconds)
        : focusSeconds;
      return {
        kind: "study" as const,
        title: snapshot.study.taskTitleSnapshot,
        status: snapshot.study.status === "paused" ? "已暂停" : overtime ? "本轮已到时" : interval?.kind === "break" ? "休息中" : "正在专注",
        seconds,
        paused: snapshot.study.status === "paused",
      };
    }
    if (snapshot.meditation) {
      const interval = snapshot.meditationIntervals.find((item) => item.id === snapshot.meditation?.activeIntervalId);
      const elapsed = Math.floor(totalMeditationMs(snapshot.meditationIntervals, new Date(now).toISOString()) / 1000);
      const phase = interval ? Math.floor(meditationEffectiveMs(interval, new Date(now).toISOString()) / 1000) : 0;
      const overtime = Boolean(snapshot.meditation.mode === "timed" && snapshot.meditation.status !== "breathing" && snapshot.meditation.targetSeconds && elapsed >= snapshot.meditation.targetSeconds);
      return {
        kind: "meditation" as const,
        title: snapshot.meditation.intentionNote || "Meditation",
        status: snapshot.meditation.status === "paused" ? "已暂停" : snapshot.meditation.status === "breathing" ? "呼吸引导" : overtime ? "冥想已到时" : "正在冥想",
        seconds: snapshot.meditation.status === "breathing" ? phase : overtime && snapshot.meditation.targetSeconds ? elapsed - snapshot.meditation.targetSeconds : elapsed,
        paused: snapshot.meditation.status === "paused",
      };
    }
    return null;
  }, [now, snapshot]);

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try { await operation(); await refresh(); }
    finally { setBusy(false); }
  };

  const toggle = () => {
    const study = snapshot.study;
    if (study) return void run(() => study.status === "paused" ? executionAdapter.resume(study) : executionAdapter.pause(study));
    const meditation = snapshot.meditation;
    if (meditation) return void run(() => meditation.status === "paused" ? meditationAdapter.resume(meditation) : meditationAdapter.pause(meditation));
  };

  const requestFinish = async () => {
    if (!state) return;
    await desktopBridge.sendTimerAction("finish", state.kind);
    await desktopBridge.showMain();
    await desktopBridge.hideTimer();
  };

  const expand = async () => {
    if (!state) return;
    await desktopBridge.sendTimerAction("expand", state.kind);
    await desktopBridge.showMain();
    await desktopBridge.hideTimer();
  };
  const beginMove = (event: PointerEvent<HTMLButtonElement>) => {
    movePointer.current = { pointerId: event.pointerId, screenX: event.screenX, screenY: event.screenY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const continueMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = movePointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.screenX - current.screenX, dy = event.screenY - current.screenY;
    if (dx || dy) { current.screenX = event.screenX; current.screenY = event.screenY; void desktopBridge.moveTimerBy(dx, dy); }
  };
  const endMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!movePointer.current || movePointer.current.pointerId !== event.pointerId) return;
    movePointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const nudgeMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = 20;
    const distance = event.key === "ArrowLeft" ? [-step, 0] : event.key === "ArrowRight" ? [step, 0] : event.key === "ArrowUp" ? [0, -step] : event.key === "ArrowDown" ? [0, step] : null;
    if (!distance) return;
    event.preventDefault(); void desktopBridge.moveTimerBy(distance[0], distance[1]);
  };

  if (!state) return <main className="desktop-timer-empty"><strong>暂无进行中的计时</strong><button onClick={() => void desktopBridge.showMain()}>打开 StudyFlow</button></main>;

  return <main className="desktop-timer-shell" aria-label="StudyFlow 独立计时器">
    <div className="desktop-timer-titlebar"><span>StudyFlow</span><button className="desktop-timer-move" aria-label="拖动小窗；可使用方向键微调位置" onPointerDown={beginMove} onPointerMove={continueMove} onPointerUp={endMove} onPointerCancel={endMove} onKeyDown={nudgeMove}>⋮⋮ 移动</button></div>
    <button className="desktop-timer-close" aria-label="隐藏计时器" onClick={() => void desktopBridge.hideTimer()}><X /></button>
    <div className="desktop-timer-copy"><strong title={state.title}>{state.title}</strong><small>{state.status}</small></div>
    <time>{formatDuration(state.seconds)}</time>
    <div className="desktop-timer-actions">
      <button aria-label={state.paused ? "继续计时" : "暂停计时"} disabled={busy} onClick={toggle}>{state.paused ? <Play /> : <Pause />}</button>
      <button aria-label="展开到完整专注页" onClick={() => void expand()}><Maximize2 /></button>
      <button aria-label={state.kind === "study" ? "结束学习" : "结束冥想"} onClick={() => void requestFinish()}><Square /></button>
    </div>
  </main>;
}
