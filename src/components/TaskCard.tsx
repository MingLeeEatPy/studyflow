import type { Category, Task } from "../domain/models";

interface TaskCardProps {
  task: Task;
  category?: Category;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStart?: (task: Task) => void;
  actualMinutes?: number;
  compact?: boolean;
  onSetCore?: (task: Task) => void;
}

export function TaskCard({ task, category, onToggle, onEdit, onDelete, onStart, actualMinutes, compact, onSetCore }: TaskCardProps) {
  return (
    <article aria-label={task.title} data-completed={String(task.completed)} className={`task-card${task.completed ? " completed" : ""}${compact ? " compact" : ""}`}>
      <label className="complete-toggle"><input type="checkbox" aria-label="标记完成" checked={task.completed} onChange={() => onToggle(task)} /><span>{task.completed ? "✓" : ""}</span></label>
      <div className="task-body">
        <h3>{task.title}</h3>
        <div className="task-meta"><span className="tag category">{category?.name ?? "未知分类"}</span><span>预计 {task.estimatedMinutes} 分钟</span>{actualMinutes !== undefined && <span>实际 {actualMinutes} 分钟</span>}<span>截止 {task.dueDate}</span>{task.important && <span className="tag important">重要</span>}{task.urgent && <span className="tag urgent">紧急</span>}{task.isCoreTask && <span className="tag important">Today's #1</span>}{(task.avoidanceCount ?? 0) > 0 && <span className="tag urgent">已回避 {task.avoidanceCount} 次</span>}{task.minimumStartMinutes && <span>最小开始 {task.minimumStartMinutes} 分钟</span>}</div>
      </div>
      <div className="task-actions">{!task.completed && onStart && <button type="button" className="start-text" onClick={() => onStart(task)}>{task.minimumStartMinutes ? `${task.minimumStartMinutes} 分钟开始` : "开始学习"}</button>}{!task.completed && onSetCore && <button type="button" onClick={() => onSetCore(task)}>{task.isCoreTask ? "取消 #1" : "设为 Today #1"}</button>}<button type="button" onClick={() => onEdit(task)}>编辑</button><button type="button" className="danger-text" onClick={() => onDelete(task)}>删除</button></div>
    </article>
  );
}
