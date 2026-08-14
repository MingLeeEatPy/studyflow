import { useEffect, useState } from "react";
import type { Category, Task } from "../domain/models";
import { calculateTodayStats, selectTodayTasks } from "../domain/today";
import { TaskCard } from "../components/TaskCard";
import type { StudySession } from "../features/executionTypes";
import { executionAdapter } from "../features/executionAdapter";
import { sessionFocusSecondsOnLocalDate, totalFocusMs } from "../domain/execution";

export function TodayPage({ tasks, categories, sessions = [], taskActualMinutes = {}, activeSession, now = Date.now(), onToggle, onEdit, onDelete, onNew, onStart }: { tasks: Task[]; categories: Category[]; sessions?: StudySession[]; sessionDurations?: Record<string,number>; taskActualMinutes?: Record<string,number>; activeSession?: StudySession | null; now?: number; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onNew: () => void; onStart?: (task: Task) => void }) {
  const [execution, setExecution] = useState<{ actualSeconds: number; taskMinutes: Record<string, number>; active: StudySession | null }>({ actualSeconds: 0, taskMinutes: taskActualMinutes, active: activeSession ?? null });
  const todayTasks = selectTodayTasks(tasks);
  const stats = calculateTodayStats(tasks);
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const localToday = new Date().toLocaleDateString("en-CA");
  const minuteTick = Math.floor(now / 60_000);
  useEffect(() => { let cancelled = false; void (async () => { const active = await executionAdapter.getActive(); const history = sessions.length ? sessions : await executionAdapter.history(); const all = active ? [...history, active] : history; const intervalGroups = await Promise.all(all.map((item) => executionAdapter.listIntervals(item.id))); const actualSeconds = all.reduce((sum, item, index) => sum + sessionFocusSecondsOnLocalDate(item, intervalGroups[index], localToday), 0); const taskSeconds: Record<string, number> = {}; all.forEach((item, index) => { if (item.taskId) taskSeconds[item.taskId] = (taskSeconds[item.taskId] ?? 0) + totalFocusMs(intervalGroups[index]) / 1000; }); if (!cancelled) setExecution({ actualSeconds, taskMinutes: Object.fromEntries(Object.entries(taskSeconds).map(([id, seconds]) => [id, Math.round(seconds / 60)])), active }); })(); return () => { cancelled = true; }; }, [sessions, localToday, minuteTick]);
  const actualMinutes = Math.round(execution.actualSeconds / 60);
  return <>
    <header className="page-header"><div><p className="eyebrow">今日计划</p><h1>今天，一步一步完成</h1><p>集中处理今天到期和已经逾期的学习任务。</p></div><button className="button primary" onClick={onNew}>＋ 新建任务</button></header>
    <section className="stats-grid" aria-label="今日时长统计">
      <article className="stat-card planned"><span>今日计划</span><strong data-testid="planned-minutes">{stats.plannedMinutes}</strong><small>分钟</small></article>
      <article className="stat-card finished"><span>已经完成</span><strong data-testid="completed-minutes">{stats.completedMinutes}</strong><small>分钟</small></article>
      <article className="stat-card remaining"><span>剩余时间</span><strong data-testid="remaining-minutes">{stats.remainingMinutes}</strong><small>分钟</small></article>
      <article className="stat-card actual"><span>实际专注</span><strong data-testid="actual-minutes">{actualMinutes}</strong><small>分钟</small></article>
    </section>
    {execution.active && <aside className="today-active"><span>正在学习</span><strong>{execution.active.taskTitleSnapshot}</strong><small>{execution.active.mode === "pomodoro" ? `番茄钟 · 第 ${execution.active.pomodoroRound} 轮` : "正计时"}</small></aside>}
    <section className="section-heading"><div><h2>今日任务</h2><p>{todayTasks.filter((item) => !item.completed).length} 项待完成 · {todayTasks.filter((item) => item.completed).length} 项已完成</p></div></section>
    <div className="task-stack">{todayTasks.map((task) => <TaskCard key={task.id} task={task} category={categoryMap.get(task.categoryId)} actualMinutes={execution.taskMinutes[task.id] ?? 0} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onStart={onStart} />)}{todayTasks.length === 0 && <div className="empty-state"><span>✓</span><h3>今天的任务已清空</h3><p>可以休息一下，或者为下一步创建新任务。</p><button className="button secondary" onClick={onNew}>创建任务</button></div>}</div>
  </>;
}
