import { useEffect, useMemo, useState } from "react";
import type { Category, Task } from "../domain/models";
import { groupTasksByQuadrant, QUADRANT_LABELS, type Quadrant } from "../domain/quadrant";
import { TaskCard } from "../components/TaskCard";
import { executionAdapter } from "../features/executionAdapter";
import { totalFocusMs } from "../domain/execution";

const quadrantOrder: Quadrant[] = ["important-urgent", "important-not-urgent", "not-important-urgent", "not-important-not-urgent"];

export function PlanPage({ tasks, categories, taskActualMinutes = {}, onToggle, onEdit, onDelete, onNew, onStart }: { tasks: Task[]; categories: Category[]; taskActualMinutes?: Record<string,number>; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onNew: () => void; onStart?: (task: Task) => void }) {
  const [actuals, setActuals] = useState(taskActualMinutes);
  const [view, setView] = useState<"board" | "list">("board");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("active");
  const [dateFilter, setDateFilter] = useState("all");
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const filtered = useMemo(() => tasks.filter((task) => {
    if (categoryId !== "all" && task.categoryId !== categoryId) return false;
    if (status === "active" && task.completed) return false;
    if (status === "completed" && !task.completed) return false;
    if (dateFilter === "overdue" && (task.dueDate >= localToday || task.completed)) return false;
    if (dateFilter === "today" && task.dueDate !== localToday) return false;
    if (dateFilter === "future" && task.dueDate <= localToday) return false;
    return true;
  }), [tasks, categoryId, status, dateFilter, localToday]);
  const grouped = groupTasksByQuadrant(filtered);
  useEffect(() => { let cancelled = false; void (async () => { const history = await executionAdapter.history(); const active = await executionAdapter.getActive(); const all = active ? [...history, active] : history; const groups = await Promise.all(all.map((item) => executionAdapter.listIntervals(item.id))); const seconds: Record<string, number> = {}; all.forEach((item, index) => { if (item.taskId) seconds[item.taskId] = (seconds[item.taskId] ?? 0) + totalFocusMs(groups[index]) / 1000; }); if (!cancelled) setActuals(Object.fromEntries(Object.entries(seconds).map(([id, value]) => [id, Math.round(value / 60)]))); })(); return () => { cancelled = true; }; }, [tasks]);
  return <>
    <header className="page-header">
<div>
<p className="eyebrow">计划中心</p>
<h1>学习计划</h1>
<p>按照优先级安排时间，把注意力放在真正重要的事情上。</p>
</div>
<button className="button primary" onClick={onNew}>＋ 新建任务</button>
</header>
    <div className="toolbar">
      <div className="segmented" aria-label="视图">
<button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>四象限</button>
<button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>任务列表</button>
</div>
      <div className="filters">
<select aria-label="按分类筛选" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
<option value="all">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
<select aria-label="按状态筛选" value={status} onChange={(e) => setStatus(e.target.value)}>
<option value="active">待完成</option>
<option value="completed">已完成</option>
<option value="all">全部状态</option>
</select>
<select aria-label="按日期筛选" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
<option value="all">全部日期</option>
<option value="overdue">已逾期</option>
<option value="today">今天截止</option>
<option value="future">未来任务</option>
</select>
</div>
    </div>
    {view === "board" ? <div className="quadrant-grid">{quadrantOrder.map((quadrant) => <section role="region" aria-label={QUADRANT_LABELS[quadrant]} className={`quadrant ${quadrant}`} key={quadrant}>
<header>
<h2>{QUADRANT_LABELS[quadrant]}</h2>
<span>{grouped[quadrant].length}</span>
</header>
<div>{grouped[quadrant].map((task) => <TaskCard compact key={task.id} task={task} category={categoryMap.get(task.categoryId)} actualMinutes={actuals[task.id] ?? 0} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onStart={onStart} />)}{grouped[quadrant].length === 0 && <p className="quadrant-empty">暂无任务</p>}</div>
</section>)}</div> : <div className="task-stack">{filtered.map((task) => <TaskCard key={task.id} task={task} category={categoryMap.get(task.categoryId)} actualMinutes={actuals[task.id] ?? 0} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onStart={onStart} />)}{filtered.length === 0 && <div className="empty-state">
<span>⌕</span>
<h3>没有符合条件的任务</h3>
<p>尝试调整筛选条件，或创建一个新任务。</p>
</div>}</div>}
  </>;
}
