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
}

export function TaskCard({ task, category, onToggle, onEdit, onDelete, onStart, actualMinutes, compact }: TaskCardProps) {
  return (
    <article aria-label={task.title} data-completed={String(task.completed)} className={`task-card${task.completed ? " completed" : ""}${compact ? " compact" : ""}`}>
      <label className="complete-toggle"><input type="checkbox" aria-label="标记完成" checked={task.completed} onChange={() => onToggle(task)} /><span>{task.completed ? "✓" : ""}</span></label>
      <div className="task-body">
        <h3>{task.title}</h3>
        <div className="task-meta"><span className="tag category">{category?.name ?? "未知分类"}</span><span>预计 {task.estimatedMinutes} 分钟</span>{actualMinutes !== undefined && <span>实际 {actualMinutes} 分钟</span>}<span>截止 {task.dueDate}</span>{task.important && <span className="tag important">重要</span>}{task.urgent && <span className="tag urgent">紧急</span>}</div>
      </div>
      <div className="task-actions">{!task.completed && onStart && <button type="button" className="start-text" onClick={() => onStart(task)}>开始学习</button>}<button type="button" onClick={() => onEdit(task)}>编辑</button><button type="button" className="danger-text" onClick={() => onDelete(task)}>删除</button></div>
    </article>
  );
}
