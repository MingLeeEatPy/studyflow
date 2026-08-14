import { useMemo, useState } from "react";
import type { Category, Task } from "../domain/models";
import type { StudySession } from "../features/executionTypes";
import { formatDuration } from "../features/executionAdapter";

const outcomes: Record<string,string>={completed:"完成",partial:"部分完成",unfinished:"未完成"};
export function HistoryPage({ sessions, durations, tasks, categories, onRefresh, onCorrect }: { sessions: StudySession[]; durations: Record<string,number>; tasks: Task[]; categories: Category[]; onRefresh: () => void; onCorrect: (session: StudySession) => void }) {
 const [category,setCategory]=useState("all"),[taskId,setTaskId]=useState("all"),[outcome,setOutcome]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState("");
 const localDate=(iso:string,timezone:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
 const displayDate=(iso:string,timezone:string)=>new Intl.DateTimeFormat("zh-CN",{timeZone:timezone,month:"2-digit",day:"2-digit"}).format(new Date(iso));
 const displayTime=(iso:string,timezone:string)=>new Intl.DateTimeFormat("zh-CN",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));
 const filtered=useMemo(()=>sessions.filter(s=>(category==="all"||s.categoryId===category)&&(taskId==="all"||s.taskId===taskId)&&(outcome==="all"||s.outcome===outcome)&&(!from||localDate(s.startedAt,s.timezone)>=from)&&(!to||localDate(s.startedAt,s.timezone)<=to)),[sessions,category,taskId,outcome,from,to]);
 return <>
<header className="page-header">
<div>
<p className="eyebrow">执行记录</p>
<h1>学习历史</h1>
<p>每一次真实投入，都会成为调整下一步计划的依据。</p>
</div>
<button className="button secondary" onClick={onRefresh}>刷新记录</button>
</header>
<div className="toolbar history-toolbar">
<div className="filters">
<input aria-label="开始日期" type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
<input aria-label="结束日期" type="date" value={to} onChange={e=>setTo(e.target.value)}/>
<select aria-label="分类" value={category} onChange={e=>setCategory(e.target.value)}>
<option value="all">全部分类</option>{categories.map(c=>
<option key={c.id} value={c.id}>{c.name}</option>)}</select>
<select aria-label="任务" value={taskId} onChange={e=>setTaskId(e.target.value)}>
<option value="all">全部任务</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select>
<select aria-label="结果" value={outcome} onChange={e=>setOutcome(e.target.value)}>
<option value="all">全部结果</option>
<option value="completed">完成</option>
<option value="partial">部分完成</option>
<option value="unfinished">未完成</option>
</select>
</div>
</div>
<div className="history-list">{filtered.map(s=>{const task=tasks.find(t=>t.id===s.taskId);return <article className="history-card" key={s.id}>
<div className="history-date">
<strong>{displayDate(s.startedAt,s.timezone)}</strong>
<span>{displayTime(s.startedAt,s.timezone)}</span>
</div>
<div className="history-main">
<div>
<h3>{s.taskTitleSnapshot}</h3>
<span>{s.categoryNameSnapshot} · {s.mode==="pomodoro"?"番茄钟":"正计时"}{task?.archivedAt?" · 原任务已删除":""}</span>
</div>{s.summary&&<p>{s.summary}</p>}</div>
<strong className="history-duration">{formatDuration(durations[s.id]??0)}</strong>{s.outcome&&<span className={`outcome ${s.outcome}`}>{outcomes[s.outcome]}</span>}<button className="history-correct" onClick={()=>onCorrect(s)}>修正</button>
</article>})}{filtered.length===0&&<div className="empty-state">
<span>◷</span>
<h3>还没有执行记录</h3>
<p>从一个任务开始学习，记录会在结束后出现在这里。</p>
</div>}</div>
</>;
}
