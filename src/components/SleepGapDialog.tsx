import { useState } from "react";
import type { StudySession } from "../features/executionTypes";
import { formatDuration } from "../features/executionAdapter";
import { Modal } from "./Modal";

export function SleepGapDialog({ gapSeconds: gap, onResolve }: { session: StudySession; gapSeconds: number; onResolve: (action: "include" | "exclude" | "correct", correctedSeconds?: number) => Promise<void> }) {
  const [choice, setChoice] = useState<"include" | "exclude" | "correct">("exclude"); const [minutes, setMinutes] = useState(Math.floor(gap / 60)); const [busy, setBusy] = useState(false);
  async function resolve() { setBusy(true); try { await onResolve(choice, choice === "correct" ? Math.min(gap, Math.max(0, minutes * 60)) : undefined); } finally { setBusy(false); } }
  return <Modal title="检测到计时中断" onClose={() => undefined}><div className="sleep-gap"><p>浏览器检测到约 <strong>{formatDuration(gap)}</strong> 的时间跳跃。请确认这段时间是否在学习。</p><label><input type="radio" checked={choice === "exclude"} onChange={() => setChoice("exclude")} /><span><strong>排除这段时间</strong><small>推荐用于电脑休眠或忘记暂停</small></span></label><label><input type="radio" checked={choice === "include"} onChange={() => setChoice("include")} /><span><strong>全部计入学习</strong><small>这段时间确实一直在学习</small></span></label><label><input type="radio" checked={choice === "correct"} onChange={() => setChoice("correct")} /><span><strong>手动修正</strong><small>实际学习了 <input type="number" min="0" max={Math.ceil(gap / 60)} value={minutes} disabled={choice !== "correct"} onChange={(e) => setMinutes(Number(e.target.value))} /> 分钟</small></span></label><footer className="modal-actions"><button className="button primary" disabled={busy} onClick={() => void resolve()}>确认并继续</button></footer></div></Modal>;
}
