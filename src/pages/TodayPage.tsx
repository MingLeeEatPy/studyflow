import type { Category, Task } from "../domain/models";
import { calculateTodayStats, selectTodayTasks } from "../domain/today";
import { TaskCard } from "../components/TaskCard";

export function TodayPage({ tasks, categories, onToggle, onEdit, onDelete, onNew }: { tasks: Task[]; categories: Category[]; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onNew: () => void }) {
  const todayTasks = selectTodayTasks(tasks);
  const stats = calculateTodayStats(tasks);
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  return <>
    <header className="page-header"><div><p className="eyebrow">今日计划</p><h1>今天，一步一步完成</h1><p>集中处理今天到期和已经逾期的学习任务。</p></div><button className="button primary" onClick={onNew}>＋ 新建任务</button></header>
    <section className="stats-grid" aria-label="今日时长统计">
      <article className="stat-card planned"><span>今日计划</span><strong data-testid="planned-minutes">{stats.plannedMinutes}</strong><small>分钟</small></article>
      <article className="stat-card finished"><span>已经完成</span><strong data-testid="completed-minutes">{stats.completedMinutes}</strong><small>分钟</small></article>
      <article className="stat-card remaining"><span>剩余时间</span><strong data-testid="remaining-minutes">{stats.remainingMinutes}</strong><small>分钟</small></article>
    </section>
    <section className="section-heading"><div><h2>今日任务</h2><p>{todayTasks.filter((item) => !item.completed).length} 项待完成</p></div></section>
    <div className="task-stack">{todayTasks.map((task) => <TaskCard key={task.id} task={task} category={categoryMap.get(task.categoryId)} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}{todayTasks.length === 0 && <div className="empty-state"><span>✓</span><h3>今天的任务已清空</h3><p>可以休息一下，或者为下一步创建新任务。</p><button className="button secondary" onClick={onNew}>创建任务</button></div>}</div>
  </>;
}
