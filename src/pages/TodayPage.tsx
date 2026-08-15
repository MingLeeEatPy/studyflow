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
  const pendingCount = todayTasks.filter((item) => !item.completed).length;
  const completedCount = todayTasks.length - pendingCount;
  const completionPercent = stats.plannedMinutes > 0 ? Math.min(100, Math.round((stats.completedMinutes / stats.plannedMinutes) * 100)) : 0;
  return <>
    <header className="page-header nature-page-header"><div><p className="eyebrow">{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</p><h1>今天，按自己的节奏前进</h1><p>把注意力放在下一件真正重要的事上。</p></div><button className="button primary" onClick={onNew}>＋ 新建任务</button></header>
    <section className="today-overview">
      <article className="today-summary-glass" aria-label="今日时长统计">
        <header><div><span>今日计划</span><strong><b data-testid="planned-minutes">{stats.plannedMinutes}</b> 分钟</strong></div><small>{completionPercent >= 100 ? "今日计划已完成" : completionPercent > 0 ? "稳定推进" : "从第一步开始"}</small></header>
        <div className="today-progress" role="progressbar" aria-label="今日计划完成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}><span style={{ width: `${completionPercent}%` }} /></div>
        <div className="stats-grid">
          <article className="stat-card finished"><span>已经完成</span><strong data-testid="completed-minutes">{stats.completedMinutes}</strong><small>分钟</small></article>
          <article className="stat-card remaining"><span>剩余时间</span><strong data-testid="remaining-minutes">{stats.remainingMinutes}</strong><small>分钟</small></article>
          <article className="stat-card actual"><span>实际专注</span><strong data-testid="actual-minutes">{actualMinutes}</strong><small>分钟</small></article>
          <article className="stat-card completed-count"><span>完成任务</span><strong>{completedCount}</strong><small>/ {todayTasks.length}</small></article>
        </div>
      </article>
      <aside className="today-rhythm-card">
        <div><span className="today-rhythm-label">当前节奏</span><h2>{execution.active ? "保持此刻的专注" : pendingCount ? "准备好，就从一件事开始" : "今天可以安心收尾"}</h2><p>{execution.active ? "离开页面不会停止计时，按照自己的节奏继续。" : pendingCount ? `还有 ${pendingCount} 项任务等待完成。` : "所有今日任务都已处理。"}</p></div>
        {execution.active ? <div className="today-active"><span className="today-active-dot"/><span><small>正在学习</small><strong>{execution.active.taskTitleSnapshot}</strong></span><b>{execution.active.mode === "pomodoro" ? `第 ${execution.active.pomodoroRound} 轮` : "正计时"}</b></div> : <div className="today-rest-mark" aria-hidden="true"><span/><span/><span/></div>}
      </aside>
    </section>
    <section className="section-heading today-list-heading"><div><h2>今日任务</h2><p>{pendingCount} 项待完成 · {completedCount} 项已完成</p></div></section>
    <div className="task-stack">{todayTasks.map((task) => <TaskCard key={task.id} task={task} category={categoryMap.get(task.categoryId)} actualMinutes={execution.taskMinutes[task.id] ?? 0} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onStart={onStart} />)}{todayTasks.length === 0 && <div className="empty-state"><span>✓</span><h3>今天的任务已清空</h3><p>可以休息一下，或者为下一步创建新任务。</p><button className="button secondary" onClick={onNew}>创建任务</button></div>}</div>
  </>;
}
