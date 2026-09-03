import type { Category, StudyInterval, StudySession, Task, WeeklyWorkloadPlan } from "./models";
import { intervalActiveMs } from "./execution";

export type AnalysisPeriod = "week" | "month";
export type DateRange = { from: string; to: string; label: string };
export type CategoryWorkload = { categoryId: string; categoryName: string; plannedActions: number; completedActions: number; focusSeconds: number; averageFocusSeconds: number | null; plannedShare: number | null; completedShare: number | null; remainingActions: number };
export type DailyWorkload = { date: string; label: string; completedActions: number; focusSeconds: number };
export type WeeklySummary = { weekStart: string; label: string; plannedActions: number; completedActions: number; focusSeconds: number };

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const dateAtStart = (key: string) => new Date(`${key}T00:00:00`);

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

function isInRange(value: string | null, range: DateRange): boolean { return Boolean(value && localKey(value) >= range.from && localKey(value) <= range.to); }

function activeOverlapMs(interval: StudyInterval, range: DateRange): number {
  const from = dateAtStart(range.from).getTime(), to = dateAtStart(range.to).getTime() + 86_400_000;
  const start = Math.max(Date.parse(interval.startedAt), from), end = Math.min(Date.parse(interval.endedAt ?? new Date().toISOString()), to);
  if (end <= start) return 0;
  const clipped: StudyInterval = { ...interval, startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), pauses: interval.pauses.map((pause) => ({ ...pause, startedAt: new Date(Math.max(Date.parse(pause.startedAt), start)).toISOString(), endedAt: pause.endedAt ? new Date(Math.min(Date.parse(pause.endedAt), end)).toISOString() : new Date(end).toISOString() })).filter((pause) => Date.parse(pause.endedAt ?? "") > Date.parse(pause.startedAt)) };
  return intervalActiveMs(clipped, new Date(end).toISOString());
}

export function buildCategoryWorkload({ categories, tasks, sessions, intervalsBySession, plan, range }: { categories: Category[]; tasks: Task[]; sessions: StudySession[]; intervalsBySession: Record<string, StudyInterval[]>; plan: WeeklyWorkloadPlan | undefined; range: DateRange }): CategoryWorkload[] {
  const allocationByCategory = new Map((plan?.allocations ?? []).map((allocation) => [allocation.categoryId, allocation]));
  const known = new Map(categories.map((category) => [category.id, category.name]));
  for (const allocation of plan?.allocations ?? []) if (!known.has(allocation.categoryId)) known.set(allocation.categoryId, allocation.categoryNameSnapshot);
  const raw = [...known].map(([categoryId, categoryName]) => ({ categoryId, categoryName, plannedActions: allocationByCategory.get(categoryId)?.plannedActions ?? 0, completedActions: tasks.filter((task) => task.categoryId === categoryId && task.completed && isInRange(task.completedAt, range)).length, focusSeconds: Math.floor(sessions.filter((session) => session.categoryId === categoryId).reduce((total, session) => total + (intervalsBySession[session.id] ?? []).reduce((sum, interval) => sum + activeOverlapMs(interval, range), 0), 0) / 1000) }));
  const plannedTotal = raw.reduce((sum, row) => sum + row.plannedActions, 0), completedTotal = raw.reduce((sum, row) => sum + row.completedActions, 0);
  return raw.map((row) => ({ ...row, plannedShare: plannedTotal ? row.plannedActions / plannedTotal : null, completedShare: completedTotal ? row.completedActions / completedTotal : null, remainingActions: Math.max(0, row.plannedActions - row.completedActions), averageFocusSeconds: row.completedActions ? Math.round(row.focusSeconds / row.completedActions) : null })).filter((row) => row.plannedActions > 0 || row.completedActions > 0 || row.focusSeconds > 0).sort((a, b) => b.plannedActions - a.plannedActions || b.completedActions - a.completedActions || a.categoryName.localeCompare(b.categoryName));
}

export function buildDailyWorkload(tasks: Task[], sessions: StudySession[], intervalsBySession: Record<string, StudyInterval[]>, range: DateRange): DailyWorkload[] {
  return Array.from({ length: Math.round((dateAtStart(range.to).getTime() - dateAtStart(range.from).getTime()) / 86_400_000) + 1 }, (_, index) => {
    const date = new Date(dateAtStart(range.from)); date.setDate(date.getDate() + index); const key = dateKey(date); const dayRange = { from: key, to: key, label: key };
    return { date: key, label: `${date.getMonth() + 1}/${date.getDate()}`, completedActions: tasks.filter((task) => task.completed && isInRange(task.completedAt, dayRange)).length, focusSeconds: Math.floor(sessions.reduce((total, session) => total + (intervalsBySession[session.id] ?? []).reduce((sum, interval) => sum + activeOverlapMs(interval, dayRange), 0), 0) / 1000) };
  });
}

export function buildWeeklySummaries(plans: WeeklyWorkloadPlan[], tasks: Task[], sessions: StudySession[], intervalsBySession: Record<string, StudyInterval[]>, range: DateRange): WeeklySummary[] {
  return plans.filter((plan) => plan.weekStart >= range.from && plan.weekStart <= range.to).map((plan) => { const week = analysisRange("week", plan.weekStart), rows = buildCategoryWorkload({ categories: [], tasks, sessions, intervalsBySession, plan, range: week }); return { weekStart: plan.weekStart, label: `${week.from.slice(5)}–${week.to.slice(5)}`, plannedActions: plan.totalPlannedActions, completedActions: rows.reduce((sum, row) => sum + row.completedActions, 0), focusSeconds: rows.reduce((sum, row) => sum + row.focusSeconds, 0) }; });
}

export function nextWeekAdvice(rows: CategoryWorkload[], currentPlan: WeeklyWorkloadPlan | undefined, recentPlans: WeeklySummary[]): string[] {
  if (!currentPlan) return ["先设定本周最低行动总量，再按科目分配；它是可调整的基准，不是压力指标。"];
  const completed = rows.reduce((sum, row) => sum + row.completedActions, 0), completionRate = completed / currentPlan.totalPlannedActions, advice: string[] = [];
  if (completionRate < .6) { const historical = recentPlans.filter((item) => item.weekStart !== currentPlan.weekStart && item.completedActions > 0).map((item) => item.completedActions).sort((a, b) => a - b); const median = historical.length ? historical[Math.floor(historical.length / 2)] : completed; advice.push(`本周最低计划完成 ${completed}/${currentPlan.totalPlannedActions}；下周可先把最低总量定为 ${Math.max(1, Math.floor(median * .6))} 个行动，为补漏和休息留出空间。`); }
  rows.filter((row) => row.remainingActions > 0).slice(0, 2).forEach((row) => advice.push(`${row.categoryName} 还差 ${row.remainingActions} 个行动；下周先保留这 ${row.remainingActions} 个最小、可完成的步骤。`));
  rows.filter((row) => row.focusSeconds >= 45 * 60 && row.completedActions === 0).slice(0, 1).forEach((row) => advice.push(`${row.categoryName} 已投入 ${Math.round(row.focusSeconds / 60)} 分钟但没有完成行动；把下一项拆成一个有明确完成条件的步骤。`));
  if (completionRate >= 1) advice.unshift("本周最低计划已经完成；下周先保持这个基准，额外工作只作为 Stretch，不必自动加量。");
  return advice.slice(0, 3);
}
