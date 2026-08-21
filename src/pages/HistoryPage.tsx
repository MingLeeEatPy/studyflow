import { useEffect, useMemo, useState } from "react";
import type { MeditationIntention, MeditationSession } from "../../shared/schemas/models";
import type { Category, Task } from "../domain/models";
import { totalMeditationMs } from "../domain/meditation";
import type { StudySession } from "../features/executionTypes";
import { formatDuration } from "../features/executionAdapter";
import { meditationAdapter } from "../features/meditationAdapter";

const outcomes: Record<string, string> = { completed: "完成", partial: "部分完成", unfinished: "未完成" };
const intentions: Record<MeditationIntention, string> = {
  calm: "平静",
  refocus: "恢复专注",
  observe: "观察情绪",
  "self-care": "自我关怀",
  rest: "休息",
  other: "其他",
};
const feelings: Record<number, string> = { 1: "更沉重", 2: "略疲惫", 3: "平稳", 4: "更放松", 5: "清明" };

type HistoryType = "all" | "study" | "meditation";
type HistoryRow =
  | { type: "study"; startedAt: string; timezone: string; session: StudySession }
  | { type: "meditation"; startedAt: string; timezone: string; session: MeditationSession };

export function HistoryPage({ sessions, durations, meditationSessions, meditationDurations, tasks, categories, onRefresh, onCorrect }: {
  sessions: StudySession[];
  durations: Record<string, number>;
  meditationSessions?: MeditationSession[];
  meditationDurations?: Record<string, number>;
  tasks: Task[];
  categories: Category[];
  onRefresh: () => void;
  onCorrect: (session: StudySession) => void;
}) {
  const [type, setType] = useState<HistoryType>("all");
  const [category, setCategory] = useState("all");
  const [taskId, setTaskId] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [loadedMeditations, setLoadedMeditations] = useState<MeditationSession[]>(meditationSessions ?? []);
  const [loadedMeditationDurations, setLoadedMeditationDurations] = useState<Record<string, number>>(meditationDurations ?? {});

  useEffect(() => {
    if (meditationSessions !== undefined && meditationDurations !== undefined) {
      setLoadedMeditations(meditationSessions);
      setLoadedMeditationDurations(meditationDurations);
      return;
    }
    let cancelled = false;
    void (async () => {
      const history = meditationSessions ?? await meditationAdapter.history();
      const groups = await Promise.all(history.map((session) => meditationAdapter.listIntervals(session.id)));
      if (!cancelled) {
        setLoadedMeditations(history);
        setLoadedMeditationDurations(Object.fromEntries(history.map((session, index) => [session.id, Math.floor(totalMeditationMs(groups[index]) / 1000)])));
      }
    })();
    return () => { cancelled = true; };
  }, [meditationSessions, meditationDurations, refreshToken]);

  const localDate = (iso: string, timezone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const displayDate = (iso: string, timezone: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const displayTime = (iso: string, timezone: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

  const filtered = useMemo(() => {
    const rows: HistoryRow[] = [
      ...sessions.map((session): HistoryRow => ({ type: "study", startedAt: session.startedAt, timezone: session.timezone, session })),
      ...loadedMeditations.map((session): HistoryRow => ({ type: "meditation", startedAt: session.startedAt, timezone: session.timezone, session })),
    ];
    return rows.filter((row) => {
      if (type !== "all" && row.type !== type) return false;
      if (from && localDate(row.startedAt, row.timezone) < from) return false;
      if (to && localDate(row.startedAt, row.timezone) > to) return false;
      if (row.type === "meditation") return category === "all" && taskId === "all" && outcome === "all";
      const session = row.session;
      return (category === "all" || session.categoryId === category)
        && (taskId === "all" || session.taskId === taskId)
        && (outcome === "all" || session.outcome === outcome);
    }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [sessions, loadedMeditations, type, category, taskId, outcome, from, to]);

  function changeType(next: HistoryType) {
    setType(next);
    if (next === "meditation") {
      setCategory("all");
      setTaskId("all");
      setOutcome("all");
    }
  }

  function refresh() {
    onRefresh();
    setRefreshToken((value) => value + 1);
  }

  return <>
    <header className="page-header">
      <div>
        <p className="eyebrow">执行记录</p>
        <h1>学习与冥想历史</h1>
        <p>学习和冥想分别计时，也共同留下真实投入的轨迹。</p>
      </div>
      <button className="button secondary" onClick={refresh}>刷新记录</button>
    </header>
    <div className="toolbar history-toolbar">
      <div className="filters">
        <select aria-label="记录类型" value={type} onChange={(event) => changeType(event.target.value as HistoryType)}>
          <option value="all">全部类型</option><option value="study">学习</option><option value="meditation">冥想</option>
        </select>
        <input aria-label="开始日期" type="date" value={from} onChange={(event) => setFrom(event.target.value)}/>
        <input aria-label="结束日期" type="date" value={to} onChange={(event) => setTo(event.target.value)}/>
        <select aria-label="分类" value={category} disabled={type === "meditation"} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="任务" value={taskId} disabled={type === "meditation"} onChange={(event) => setTaskId(event.target.value)}>
          <option value="all">全部任务</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
        <select aria-label="结果" value={outcome} disabled={type === "meditation"} onChange={(event) => setOutcome(event.target.value)}>
          <option value="all">全部结果</option><option value="completed">完成</option><option value="partial">部分完成</option><option value="unfinished">未完成</option>
        </select>
      </div>
    </div>
    <div className="history-list">
      {filtered.map((row) => row.type === "study" ? <StudyHistoryCard key={`study-${row.session.id}`} session={row.session} duration={durations[row.session.id] ?? 0} task={tasks.find((item) => item.id === row.session.taskId)} displayDate={displayDate} displayTime={displayTime} onCorrect={onCorrect}/> : <MeditationHistoryCard key={`meditation-${row.session.id}`} session={row.session} duration={loadedMeditationDurations[row.session.id] ?? 0} displayDate={displayDate} displayTime={displayTime}/>)}
      {filtered.length === 0 && <div className="empty-state"><span>◷</span><h3>还没有执行记录</h3><p>{type === "meditation" ? "完成第一次至少 1 分钟的冥想后，记录会出现在这里。" : "从一次学习或冥想开始，结束后会在这里留下记录。"}</p></div>}
    </div>
  </>;
}

function StudyHistoryCard({ session, duration, task, displayDate, displayTime, onCorrect }: { session: StudySession; duration: number; task?: Task; displayDate: (iso: string, timezone: string) => string; displayTime: (iso: string, timezone: string) => string; onCorrect: (session: StudySession) => void }) {
  return <article className="history-card">
    <div className="history-date"><strong>{displayDate(session.startedAt, session.timezone)}</strong><span>{displayTime(session.startedAt, session.timezone)}</span></div>
    <div className="history-main"><div><h3>{session.taskTitleSnapshot}</h3><span>{session.categoryNameSnapshot} · {session.mode === "pomodoro" ? "番茄钟" : "正计时"}{task?.archivedAt ? " · 原任务已删除" : ""}</span></div>{session.summary && <p>{session.summary}</p>}</div>
    <strong className="history-duration">{formatDuration(duration)}</strong>
    {session.outcome && <span className={`outcome ${session.outcome}`}>{outcomes[session.outcome]}</span>}
    <button className="history-correct" onClick={() => onCorrect(session)}>修正</button>
  </article>;
}

function MeditationHistoryCard({ session, duration, displayDate, displayTime }: { session: MeditationSession; duration: number; displayDate: (iso: string, timezone: string) => string; displayTime: (iso: string, timezone: string) => string }) {
  const intention = session.intention === "other" && session.intentionNote ? session.intentionNote : intentions[session.intention];
  return <article className="history-card meditation-history-card">
    <div className="history-date"><strong>{displayDate(session.startedAt, session.timezone)}</strong><span>{displayTime(session.startedAt, session.timezone)}</span></div>
    <div className="history-main"><div><h3>Meditation · {intention}</h3><span>{session.mode === "timed" ? "定时冥想" : "自由冥想"} · {session.feeling ? `感受：${feelings[session.feeling]}` : "未填写感受"}</span></div>{session.note && <p>{session.note}</p>}</div>
    <strong className="history-duration">{formatDuration(duration)}</strong>
    <span className="outcome completed">冥想</span>
  </article>;
}
