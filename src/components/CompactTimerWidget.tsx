import { Grip, Maximize2, Pause, Play, Square } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { formatDuration } from "../features/executionAdapter";

type CompactTimerWidgetProps = {
  kind: "study" | "meditation";
  title: string;
  statusText: string;
  seconds: number;
  paused: boolean;
  side: "left" | "right";
  onSideChange(side: "left" | "right"): void;
  onExpand(): void;
  onPause(): void;
  onResume(): void;
  onFinish(): void;
};

export function CompactTimerWidget({ kind, title, statusText, seconds, paused, side, onSideChange, onExpand, onPause, onResume, onFinish }: CompactTimerWidgetProps) {
  const dragStart = useRef<{ x: number; pointerId: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragStart.current = { x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return;
    dragStart.current = null;
    onSideChange(event.clientX < window.innerWidth / 2 ? "left" : "right");
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      onSideChange(event.key === "ArrowLeft" ? "left" : "right");
    }
  };

  return <aside className={`compact-timer compact-timer-${side}`} aria-label={kind === "study" ? "微缩学习计时器" : "微缩冥想计时器"} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
    <button className="compact-drag-handle" aria-label="移动微缩计时器，使用左右方向键选择位置" onKeyDown={moveWithKeyboard} onClick={() => onSideChange(side === "left" ? "right" : "left")}><Grip /></button>
    <div className="compact-timer-copy"><strong title={title}>{title}</strong><small>{statusText}</small></div>
    <time>{formatDuration(seconds)}</time>
    <div className="compact-timer-actions">
      <button aria-label={paused ? "继续计时" : "暂停计时"} onClick={paused ? onResume : onPause}>{paused ? <Play /> : <Pause />}</button>
      <button aria-label="展开计时器" onClick={onExpand}><Maximize2 /></button>
      <button aria-label={kind === "study" ? "结束学习" : "结束冥想"} onClick={onFinish}><Square /></button>
    </div>
  </aside>;
}
