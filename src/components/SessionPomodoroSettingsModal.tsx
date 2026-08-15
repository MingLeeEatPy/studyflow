import { useState, type FormEvent } from "react";
import { pomodoroSettingsSnapshotSchema, type PomodoroSettingsSnapshot, type StudySession } from "../../shared/schemas/models";
import { Modal } from "./Modal";
import { PomodoroSettingsFields } from "./PomodoroSettingsFields";

export function SessionPomodoroSettingsModal({ session, onClose, onSave }: {
  session: StudySession;
  onClose: () => void;
  onSave: (settings: PomodoroSettingsSnapshot) => Promise<void>;
}) {
  const [value, setValue] = useState<PomodoroSettingsSnapshot>(session.pomodoroSettingsSnapshot ?? {
    focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, roundsPerSet: 4,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const parsed = pomodoroSettingsSnapshotSchema.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "请检查番茄设置");
    setBusy(true);
    try { await onSave(parsed.data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); setBusy(false); }
  }
  return <Modal title="调整本次番茄设置" onClose={onClose}>
    <form className="session-pomodoro-edit" onSubmit={(event) => void submit(event)}>
      <PomodoroSettingsFields value={value} onChange={setValue} prefix="后续" />
      <p className="inline-warning">当前已经开始的阶段保持原时长；新设置从下一个阶段开始生效。</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit" disabled={busy}>{busy ? "正在保存…" : "保存本次设置"}</button></footer>
    </form>
  </Modal>;
}
