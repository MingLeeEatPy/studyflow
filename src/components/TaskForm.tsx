import { useEffect, useState, type FormEvent } from "react";
import type { Category, CreateTaskInput, PlanningPeriod, Task } from "../domain/models";
import { toLocalDate } from "../domain/today";
import { Modal } from "./Modal";
import { studyFlowApi } from "../features/api";

interface TaskFormProps {
  categories: Category[];
  task?: Task;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
  onClose: () => void;
}

export function TaskForm({ categories, task, onSubmit, onClose }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? categories[0]?.id ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes ?? 45);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? toLocalDate(new Date()));
  const [important, setImportant] = useState(task?.important ?? false);
  const [urgent, setUrgent] = useState(task?.urgent ?? false);
  const [isCoreTask, setIsCoreTask] = useState(task?.isCoreTask ?? false);
  const [minimumStartMinutes, setMinimumStartMinutes] = useState<number | "">(task?.minimumStartMinutes ?? "");
  const [planId, setPlanId] = useState(task?.planId ?? "");
  const [plans, setPlans] = useState<PlanningPeriod[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void studyFlowApi.planning.list().then((items) => setPlans(items.filter((item) => item.type === "week"))); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("请输入任务标题");
    if (!categoryId) return setError("请先创建一个分类");
    if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 1440) {
      return setError("预计时长必须是 1–1440 分钟的整数");
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ title: title.trim(), categoryId, estimatedMinutes, dueDate, important, urgent, planId: planId || null, isCoreTask, minimumStartMinutes: minimumStartMinutes === "" ? null : minimumStartMinutes });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={task ? "编辑任务" : "新建任务"} onClose={onClose}>
      <form className="task-form" onSubmit={submit}>
        <label className="field field-wide">任务标题<input autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：完成线性代数习题" /></label>
        <label className="field">所属分类<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="field">预计完成时长<input type="number" min={1} max={1440} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))} /></label>
        <label className="field field-wide">截止日期<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <label className="field field-wide">关联周度计划<select value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="">不关联周度计划</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}（{plan.startDate} 至 {plan.endDate}）</option>)}</select></label>
        <label className="check-card"><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /><span><strong>重要</strong><small>对学习目标有明显影响</small></span></label>
        <label className="check-card"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /><span><strong>紧急</strong><small>需要尽快处理</small></span></label>
        <label className="check-card"><input type="checkbox" checked={isCoreTask} onChange={(e) => setIsCoreTask(e.target.checked)} /><span><strong>Today's #1</strong><small>今天最重要的任务</small></span></label>
        <label className="field">最小开始（可选）<input type="number" min={1} max={60} value={minimumStartMinutes} onChange={(e) => setMinimumStartMinutes(e.target.value === "" ? "" : Number(e.target.value))} placeholder="例如 5" /></label>
        {error && <p className="form-error field-wide" role="alert">{error}</p>}
        <footer className="modal-actions field-wide"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={saving}>{saving ? "保存中…" : "保存"}</button></footer>
      </form>
    </Modal>
  );
}
