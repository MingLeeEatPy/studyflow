import { useState } from "react";
import type { FinishMeditationInput } from "../../shared/schemas/models";
import { formatDuration } from "../features/executionAdapter";
import { Modal } from "./Modal";

const feelings = [[1,"更沉重"],[2,"略疲惫"],[3,"平稳"],[4,"更放松"],[5,"清明"]] as const;
export function FinishMeditationModal({ seconds, onClose, onFinish }: { seconds: number; onClose: () => void; onFinish: (input: FinishMeditationInput) => Promise<void> }) {
  const [feeling,setFeeling] = useState<number|null>(null); const [note,setNote] = useState(""); const [busy,setBusy] = useState(false);
  async function save(input: FinishMeditationInput) { setBusy(true); try { await onFinish(input); } finally { setBusy(false); } }
  return <Modal title="结束本次冥想" onClose={onClose}><div className="meditation-review"><div className="finish-summary"><span>核心冥想</span><strong>{formatDuration(seconds)}</strong><small>呼吸引导未计入</small></div><fieldset><legend>此刻的感受（可选）</legend>{feelings.map(([value,label]) => <label className={feeling === value ? "selected" : ""} key={value}><input type="radio" checked={feeling === value} onChange={() => setFeeling(value)}/><strong>{value}</strong><span>{label}</span></label>)}</fieldset><label className="field">留下一句话（可选）<textarea value={note} maxLength={2000} placeholder="此刻注意到了什么？" onChange={(event) => setNote(event.target.value)}/></label>{seconds < 60 && <p className="inline-warning">核心冥想不足 1 分钟，本次记录将自动丢弃。</p>}<footer className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => void save({ feeling: null, note: "" })}>跳过复盘并保存</button><button className="button primary" disabled={busy} onClick={() => void save({ feeling, note })}>{busy ? "正在保存…" : "保存冥想"}</button></footer></div></Modal>;
}
