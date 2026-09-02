import type { Category, StudyInterval, StudySession, Task, WorkloadTarget } from "./models";
import { totalFocusMs } from "./execution";

export type AnalysisPeriod = "week" | "month";
export type DateRange = { from: string; to: string; label: string };
export type CategoryWorkload = { categoryId: string; categoryName: string; plannedActions: number; plannedShare: number | null; completedActions: number; completedShare: number | null; focusSeconds: number; focusShare: number | null; deviationPoints: number | null };

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

export function analysisRange(period: AnalysisPeriod, anchor: string): DateRange {
  const date = new Date(`${anchor}T12:00:00`);
  if (period === "month") {
    const from = new Date(date.getFullYear(), date.getMonth(), 1), to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: dateKey(from), to: dateKey(to), label: `${date.getFullYear()} 年 ${date.getMonth() + 1} 月` };
  }
  const offset = (date.getDay() + 6) % 7, from = new Date(date); from.setDate(date.getDate() - offset);
  const to = new Date(from); to.setDate(from.getDate() + 6);
  return { from: dateKey(from), to: dateKey(to), label: `${from.getMonth() + 1}/${from.getDate()} – ${to.getMonth() + 1}/${to.getDate()}` };
}

export function buildCategoryWorkload({ categories, tasks, sessions, intervalsBySession, targets, range }: { categories: Category[]; tasks: Task[]; sessions: StudySession[]; intervalsBySession: Record<string, StudyInterval[]>; targets: WorkloadTarget[]; range: DateRange }): CategoryWorkload[] {
  const targetByCategory = new Map(targets.map((target) => [target.categoryId, target.plannedActions]));
  const inRange = (value: string | null) => Boolean(value && localKey(value) >= range.from && localKey(value) <= range.to);
  const raw = categories.filter((category) => !category.archivedAt).map((category) => ({
    categoryId: category.id, categoryName: category.name, plannedActions: targetByCategory.get(category.id) ?? 0,
    completedActions: tasks.filter((task) => task.categoryId === category.id && task.completed && inRange(task.completedAt)).length,
    focusSeconds: Math.floor(sessions.filter((session) => session.categoryId === category.id && inRange(session.startedAt)).reduce((sum, session) => sum + totalFocusMs(intervalsBySession[session.id] ?? []) / 1000, 0)),
  }));
  const plannedTotal = raw.reduce((sum, row) => sum + row.plannedActions, 0), completedTotal = raw.reduce((sum, row) => sum + row.completedActions, 0), focusTotal = raw.reduce((sum, row) => sum + row.focusSeconds, 0);
  return raw.map((row) => {
    const plannedShare = plannedTotal ? row.plannedActions / plannedTotal : null, completedShare = completedTotal ? row.completedActions / completedTotal : null;
    return { ...row, plannedShare, completedShare, focusShare: focusTotal ? row.focusSeconds / focusTotal : null, deviationPoints: plannedShare !== null && completedShare !== null ? Math.round((completedShare - plannedShare) * 100) : null };
  }).sort((a, b) => b.plannedActions - a.plannedActions || b.completedActions - a.completedActions || a.categoryName.localeCompare(b.categoryName));
}
