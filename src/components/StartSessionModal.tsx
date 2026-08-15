import { useEffect, useState, type FormEvent } from "react";
import type { Category, Task } from "../domain/models";
import type { ExecutionSettings, StartContext, StartSessionInput, TimerMode } from "../features/executionTypes";
import type { PomodoroSettingsSnapshot } from "../../shared/schemas/models";
import { Modal } from "./Modal";
import { PomodoroSettingsFields } from "./PomodoroSettingsFields";

export function StartSessionModal({ context, tasks, categories, settings, busy, onClose, onStart }: {
  context: StartContext;
  tasks: Task[];
  categories: Category[];
  settings: ExecutionSettings | null;
  busy?: boolean;
  onClose: () => void;
  onStart: (mode: TimerMode, input: StartSessionInput) => Promise<void>;
}) {
  const initialTask = context.task;
  const [taskId, setTaskId] = useState(initialTask?.id ?? "");
  const [categoryId, setCategoryId] = useState(initialTask?.categoryId ?? context.category?.id ?? categories[0]?.id ?? "");
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<TimerMode>("stopwatch");
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettingsSnapshot>({
    focusMinutes: settings?.focusMinutes ?? 25,
    shortBreakMinutes: settings?.shortBreakMinutes ?? 5,
    longBreakMinutes: settings?.longBreakMinutes ?? 15,
    roundsPerSet: settings?.roundsPerSet ?? 4,
  });
  const [error, setError] = useState("");
  useEffect(() => {
    const selected = tasks.find((task) => task.id === taskId);
    if (selected) { setCategoryId(selected.categoryId); setTitle(selected.title); }
  }, [taskId, tasks]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const selected = tasks.find((task) => task.id === taskId);
    if (!categoryId) return setError("请选择学习分类");
    if (!selected && !title.trim()) return setError("临时学习需要填写名称");
    try { await onStart(mode, { taskId: selected?.id ?? null, categoryId, title: selected?.title ?? title.trim(), goal: goal.trim(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, pomodoroSettings: mode === "pomodoro" ? pomodoroSettings : undefined }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "无法开始学习"); }
  }
  return <Modal title="开始学习" onClose={onClose}>
    <form className="session-form" onSubmit={(event) => void submit(event)}>
      <label className="field field-wide">关联任务<select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">临时学习（不关联任务）</option>{tasks.filter((task) => !task.completed).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
      {!taskId && <label className="field field-wide">学习名称<input value={title} maxLength={200} placeholder="例如：复习今天的课程" onChange={(event) => setTitle(event.target.value)} /></label>}
      <label className="field">分类<select disabled={Boolean(taskId)} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="field field-wide">本次目标（可选）<input value={goal} maxLength={200} placeholder="结束时希望达到什么结果？" onChange={(event) => setGoal(event.target.value)} /></label>
      <fieldset className="mode-picker field-wide"><legend>计时方式</legend><label className={mode === "stopwatch" ? "selected" : ""}><input type="radio" name="mode" checked={mode === "stopwatch"} onChange={() => setMode("stopwatch")} /><strong>正计时</strong><span>适合自由安排时间的学习</span></label><label className={mode === "pomodoro" ? "selected" : ""}><input type="radio" name="mode" checked={mode === "pomodoro"} onChange={() => setMode("pomodoro")} /><strong>番茄钟</strong><span>专注与休息交替进行</span></label></fieldset>
      {mode === "pomodoro" && <fieldset className="session-pomodoro field-wide"><legend>本次番茄设置</legend><PomodoroSettingsFields value={pomodoroSettings} onChange={setPomodoroSettings} /><p>只用于本次学习，不会修改“专注设置”中的默认值。</p></fieldset>}
      {error && <p className="form-error field-wide" role="alert">{error}</p>}
      <footer className="modal-actions field-wide"><button className="button secondary" type="button" onClick={onClose}>取消</button><button className="button primary" disabled={busy} type="submit">{busy ? "正在开始…" : "进入 Focus"}</button></footer>
    </form>
  </Modal>;
}
