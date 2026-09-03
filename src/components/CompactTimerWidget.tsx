import { Grip, Maximize2, Pause, Play, Square } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { formatDuration } from "../features/executionAdapter";
import type { CompactTimerPosition } from "../features/compactTimerPreference";

type CompactTimerWidgetProps = {
  kind: "study" | "meditation";
  title: string;
  statusText: string;
  seconds: number;
  paused: boolean;
  side: "left" | "right";
  position?: CompactTimerPosition;
  onSideChange(side: "left" | "right"): void;
  onPositionChange(position: CompactTimerPosition): void;
  onExpand(): void;
  onPause(): void;
  onResume(): void;
  onFinish(): void;
};

export function CompactTimerWidget({ kind, title, statusText, seconds, paused, side, position, onSideChange, onPositionChange, onExpand, onPause, onResume, onFinish }: CompactTimerWidgetProps) {
  const widgetRef = useRef<HTMLElement>(null);
  const dragStart = useRef<{ offsetX: number; offsetY: number; pointerId: number } | null>(null);
  const didDrag = useRef(false);
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const bounds = widgetRef.current?.getBoundingClientRect();
    if (!bounds) return;
    didDrag.current = false;
    dragStart.current = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragStart.current, bounds = widgetRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
    if (Math.abs(event.clientX - drag.offsetX - bounds.left) > 2 || Math.abs(event.clientY - drag.offsetY - bounds.top) > 2) didDrag.current = true;
    const x = Math.max(8, Math.min(window.innerWidth - bounds.width - 8, event.clientX - drag.offsetX));
    const y = Math.max(8, Math.min(window.innerHeight - bounds.height - 8, event.clientY - drag.offsetY));
    onPositionChange({ x, y });
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return;
    dragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      onSideChange(event.key === "ArrowLeft" ? "left" : "right");
    }
  };
  const toggleSide = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onSideChange(side === "left" ? "right" : "left");
  };

  const widget = <aside ref={widgetRef} className={`compact-timer compact-timer-${side}`} style={position ? { left: position.x, top: position.y, right: "auto" } : undefined} aria-label={kind === "study" ? "微缩学习计时器" : "微缩冥想计时器"}>
    <button className="compact-drag-handle" aria-label="拖动微缩计时器；使用左右方向键快速靠边" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onKeyDown={moveWithKeyboard} onClick={toggleSide}><Grip /></button>
    <div className="compact-timer-copy"><strong title={title}>{title}</strong><small>{statusText}</small></div>
    <time>{formatDuration(seconds)}</time>
    <div className="compact-timer-actions">
      <button aria-label={paused ? "继续计时" : "暂停计时"} onClick={paused ? onResume : onPause}>{paused ? <Play /> : <Pause />}</button>
      <button aria-label="展开计时器" onClick={onExpand}><Maximize2 /></button>
      <button aria-label={kind === "study" ? "结束学习" : "结束冥想"} onClick={onFinish}><Square /></button>
    </div>
  </aside>;

  // Rendering at document.body prevents iPad split-view containers from creating
  // a stacking context that can cover a fixed-position timer.
  return createPortal(widget, document.body);
}
