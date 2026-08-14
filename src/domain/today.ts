import type { Task } from "./models";

export function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function occurredOnLocalDate(isoDateTime: string | null, date: string): boolean {
  return isoDateTime !== null && toLocalDate(new Date(isoDateTime)) === date;
}

export function isTodayTask(task: Task, now = new Date()): boolean {
  if (task.archivedAt !== null) return false;
  const today = toLocalDate(now);
  if (task.dueDate > today) return false;
  return !task.completed || occurredOnLocalDate(task.completedAt, today);
}

export function selectTodayTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.filter((task) => isTodayTask(task, now)).sort(compareTasks);
}

export function compareTasks(left: Task, right: Task): number {
  if (left.completed !== right.completed) return Number(left.completed) - Number(right.completed);
  return left.dueDate.localeCompare(right.dueDate) || left.createdAt.localeCompare(right.createdAt);
}

export interface TodayStats {
  plannedMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
}

export function calculateTodayStats(tasks: Task[], now = new Date()): TodayStats {
  const todayTasks = selectTodayTasks(tasks, now);
  return todayTasks.reduce<TodayStats>(
    (stats, task) => ({
      plannedMinutes: stats.plannedMinutes + task.estimatedMinutes,
      completedMinutes: stats.completedMinutes + (task.completed ? task.estimatedMinutes : 0),
      remainingMinutes: stats.remainingMinutes + (!task.completed ? task.estimatedMinutes : 0),
    }),
    { plannedMinutes: 0, completedMinutes: 0, remainingMinutes: 0 },
  );
}

