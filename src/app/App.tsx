import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { BookOpen, CalendarCheck, Database, History, LayoutGrid, Leaf, Play, Settings, Tags } from "lucide-react";
import type { Category, CreateTaskInput, Task } from "../domain/models";
import type { ExecutionSettings, FinishSessionInput, StartContext, StartSessionInput, StudyInterval, StudySession, TimerMode } from "../features/executionTypes";
import type { PomodoroSettingsSnapshot } from "../../shared/schemas/models";
import { executionAdapter } from "../features/executionAdapter";
import { intervalActiveMs, totalFocusMs } from "../domain/execution";
import { studyFlowApi } from "../features/api";
import { TodayPage } from "../pages/TodayPage"; import { PlanPage } from "../pages/PlanPage"; import { CategoriesPage } from "../pages/CategoriesPage"; import { FocusPage } from "../pages/FocusPage"; import { HistoryPage } from "../pages/HistoryPage"; import { ExecutionSettingsPage } from "../pages/ExecutionSettingsPage";
import { TaskForm } from "../components/TaskForm"; import { ConfirmDialog } from "../components/ConfirmDialog"; import { Modal } from "../components/Modal"; import { StartSessionModal } from "../components/StartSessionModal"; import { ActiveSessionBar } from "../components/ActiveSessionBar"; import { FinishSessionModal } from "../components/FinishSessionModal"; import { SessionCorrectionModal } from "../components/SessionCorrectionModal"; import { SessionPomodoroSettingsModal } from "../components/SessionPomodoroSettingsModal"; import { SleepGapDialog } from "../components/SleepGapDialog";
import { backupSchema } from "../../shared/schemas/backup";

type Page="today"|"plan"|"categories"|"history"|"settings"|"focus"; type DeleteTarget={type:"task";item:Task}|{type:"category";item:Category};
function downloadJson(data:unknown,prefix="studyflow-backup"){const d=new Date(),local=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=`${prefix}-${local}.json`;a.click();URL.revokeObjectURL(url)}
function playNotificationSound(volume:number){if(!("AudioContext" in window))return;try{const audio=new AudioContext(),peak=Math.max(.05,Math.min(.5,volume/200));void audio.resume().then(()=>{[0,.22,.44].forEach((delay,index)=>{const start=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=index===2?880:660;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(peak,start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+.18);osc.connect(gain);gain.connect(audio.destination);osc.start(start);osc.stop(start+.2)});setTimeout(()=>void audio.close(),900)}).catch(()=>void audio.close())}catch{/* 浏览器阻止自动播放时由页面视觉提醒兜底 */}}
export default function App(){
 const [page,setPage]=useState<Page>("today"),[lastPage,setLastPage]=useState<Page>("today"),[tasks,setTasks]=useState<Task[]>([]),[categories,setCategories]=useState<Category[]>([]),[sessions,setSessions]=useState<StudySession[]>([]),[active,setActive]=useState<StudySession|null>(null),[intervals,setIntervals]=useState<StudyInterval[]>([]),[sessionDurations,setSessionDurations]=useState<Record<string,number>>({}),[settings,setSettings]=useState<ExecutionSettings|null>(null),[now,setNow]=useState(Date.now()),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[finishOpen,setFinishOpen]=useState(false),[pomodoroEditOpen,setPomodoroEditOpen]=useState(false),[startContext,setStartContext]=useState<StartContext|null>(null),[correcting,setCorrecting]=useState<StudySession|null>(null),[editingTask,setEditingTask]=useState<Task|null|undefined>(undefined),[deleteTarget,setDeleteTarget]=useState<DeleteTarget|null>(null),[backupOpen,setBackupOpen]=useState(false),[pendingImport,setPendingImport]=useState<unknown|null>(null); const fileRef=useRef<HTMLInputElement>(null),channelRef=useRef<BroadcastChannel|null>(null),boundaryRevision=useRef<number|null>(null),estimateNotified=useRef<string|null>(null),refreshRequest=useRef(0),activeRef=useRef<StudySession|null>(null),hasUnresolvedRef=useRef(false),overtimeRef=useRef(false);
 const heartbeatWall=useRef(Date.now()),heartbeatMonotonic=useRef(performance.now());
 const refresh=useCallback(async()=>{const request=++refreshRequest.current,[nextTasks,nextCategories,nextActive,nextHistory,nextSettings]=await Promise.all([studyFlowApi.tasks.list(),studyFlowApi.categories.list(),executionAdapter.getActive(),executionAdapter.history(),executionAdapter.getSettings()]);const nextIntervals=nextActive?await executionAdapter.listIntervals(nextActive.id):[],historyIntervals=await Promise.all(nextHistory.map(item=>executionAdapter.listIntervals(item.id)));if(request!==refreshRequest.current)return;setTasks(nextTasks);setCategories(nextCategories);setActive(nextActive);setIntervals(nextIntervals);setSessionDurations(Object.fromEntries(nextHistory.map((item,index)=>[item.id,Math.floor(totalFocusMs(historyIntervals[index])/1000)])));setSessions(nextHistory);setSettings(nextSettings)},[]);
 const mutate=useCallback(async(action:()=>Promise<StudySession|null|undefined>)=>{try{const value=await action();setActive(value??null);await refresh();channelRef.current?.postMessage("changed")}catch(e){setError(e instanceof Error?e.message:"操作失败");await refresh()}},[refresh]);
 const notifyStage=useCallback((message:string)=>{if(settings?.soundEnabled)playNotificationSound(settings.soundVolume);if(settings?.notificationsEnabled&&"Notification" in window&&Notification.permission==="granted")try{new Notification("StudyFlow",{body:message})}catch{/* 通知失败不影响计时 */}},[settings]);
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:"读取本地数据失败")).finally(()=>setLoading(false))},[refresh]);
 useEffect(()=>{void navigator.storage?.persist?.().catch(()=>false)},[]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{const channel=new BroadcastChannel("studyflow-execution");channelRef.current=channel;channel.onmessage=()=>void refresh();return()=>{channel.close();channelRef.current=null}},[refresh]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(active){e.preventDefault();e.returnValue=""}};window.addEventListener("beforeunload",guard);return()=>window.removeEventListener("beforeunload",guard)},[active]);
 useEffect(()=>{if(backupOpen)fileRef.current?.setAttribute("aria-label","导入备份文件")},[backupOpen]);
 const activeInterval=active?intervals.find(item=>item.id===active.activeIntervalId):undefined,focusSeconds=Math.floor(totalFocusMs(intervals,new Date(now).toISOString())/1000),phaseElapsed=activeInterval?Math.floor(intervalActiveMs(activeInterval,new Date(now).toISOString())/1000):0,isPomodoroOvertime=Boolean(active?.mode==="pomodoro"&&active.status==="awaiting-confirmation"&&activeInterval?.kind==="focus"&&!activeInterval.endedAt),displaySeconds=isPomodoroOvertime&&activeInterval?.targetSeconds?Math.max(0,phaseElapsed-activeInterval.targetSeconds):active?.mode==="pomodoro"&&activeInterval?.targetSeconds?Math.max(0,activeInterval.targetSeconds-phaseElapsed):focusSeconds,estimateReached=Boolean(active?.mode==="stopwatch"&&active.estimatedMinutesSnapshot&&focusSeconds>=active.estimatedMinutesSnapshot*60),continuousRunningSeconds=active?.status==="running"?Math.max(0,Math.floor((now-Date.parse(active.updatedAt))/1000)):0;
 const unresolved=intervals.flatMap(interval=>interval.sleepGaps.map((gap,index)=>({interval,gap,index}))).find(item=>item.gap.resolution===null);
 activeRef.current=active;hasUnresolvedRef.current=Boolean(unresolved);overtimeRef.current=isPomodoroOvertime;
 useEffect(()=>{let expected=Date.now()+1_000;const check=()=>{const wall=Date.now(),monotonic=performance.now(),wallGap=wall-heartbeatWall.current,callbackDelay=wall-expected,drift=wallGap-(monotonic-heartbeatMonotonic.current),from=new Date(heartbeatWall.current).toISOString(),current=activeRef.current;expected=wall+1_000;heartbeatWall.current=wall;heartbeatMonotonic.current=monotonic;const visibleJump=document.visibilityState==="visible"&&(wallGap>15_000||callbackDelay>15_000);if(current&&(current.status==="running"||overtimeRef.current)&&!hasUnresolvedRef.current&&(visibleJump||drift>15_000))void mutate(()=>executionAdapter.reportSleepGap(current,from,new Date(wall).toISOString()))};const onVisibilityChange=()=>{if(document.visibilityState==="visible")check()};const timer=window.setInterval(check,1_000);window.addEventListener("focus",check);document.addEventListener("visibilitychange",onVisibilityChange);return()=>{clearInterval(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",onVisibilityChange)}},[mutate]);
 useEffect(()=>{if(!active||active.status!=="running"||boundaryRevision.current===active.revision)return;if(active.mode==="pomodoro"&&activeInterval?.targetSeconds&&phaseElapsed>=activeInterval.targetSeconds){boundaryRevision.current=active.revision;const focusEnded=activeInterval.kind==="focus";void mutate(()=>executionAdapter.completeStage(active)).then(()=>{notifyStage(focusEnded?"本轮专注已结束，已开始超时正计时":"休息已结束");setNotice(focusEnded?"本轮专注已结束，正在记录超时专注":"休息已结束，可以开始下一轮")});return}if(active.mode==="stopwatch"&&settings&&continuousRunningSeconds>=settings.stopwatchAutoPauseMinutes*60){boundaryRevision.current=active.revision;void mutate(()=>executionAdapter.autoPause(active)).then(()=>notifyStage("正计时已自动暂停"))}},[active,activeInterval,phaseElapsed,continuousRunningSeconds,settings,mutate,notifyStage]);
 useEffect(()=>{if(active&&estimateReached&&estimateNotified.current!==active.id){estimateNotified.current=active.id;notifyStage("已达到任务预计时长");setNotice("已达到任务预计时长，计时仍在继续")}},[active,estimateReached,notifyStage]);
 async function start(mode:TimerMode,input:StartSessionInput){const value=await executionAdapter.start(mode,input);heartbeatWall.current=Date.parse(value.startedAt);heartbeatMonotonic.current=performance.now();setActive(value);setIntervals(await executionAdapter.listIntervals(value.id));setStartContext(null);setLastPage(page);setPage("focus");channelRef.current?.postMessage("changed")}
 async function finish(input:FinishSessionInput){if(!active)return;const saved=await executionAdapter.finish(active,input);setFinishOpen(false);setActive(null);setPage(lastPage==="focus"?"today":lastPage);await refresh();channelRef.current?.postMessage("changed");setNotice(saved?"学习记录已保存":"有效专注不足 1 分钟，本次记录已丢弃")}
 async function updateSessionPomodoro(input:PomodoroSettingsSnapshot){if(!active)return;const updated=await executionAdapter.updatePomodoroSettings(active,input);setActive(updated);setPomodoroEditOpen(false);await refresh();channelRef.current?.postMessage("changed");setNotice("本次番茄设置已更新，将从下一个阶段生效")}
 async function saveTask(input:CreateTaskInput){if(editingTask)await studyFlowApi.tasks.update(editingTask.id,input);else await studyFlowApi.tasks.create(input);await refresh()}
 async function toggle(task:Task){await studyFlowApi.tasks.toggleComplete(task.id);await refresh()}
 async function confirmDelete(){if(!deleteTarget)return;try{if(deleteTarget.type==="task")await studyFlowApi.tasks.archive(deleteTarget.item.id);else await studyFlowApi.categories.archive(deleteTarget.item.id);setDeleteTarget(null);await refresh()}catch(e){setError(e instanceof Error?e.message:"删除失败")}}
 async function exportData(prefix?:string){downloadJson(await studyFlowApi.backup.exportData(),prefix);await refresh();channelRef.current?.postMessage("changed");setNotice("备份已导出")}
 async function selectImport(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value="";if(!file)return;try{setPendingImport(backupSchema.parse(JSON.parse(await file.text())));setBackupOpen(false)}catch{setError("无效的备份文件：格式或版本不受支持")}}
 async function confirmImport(){if(!pendingImport)return;try{downloadJson(await studyFlowApi.backup.exportData(),"studyflow-safety-backup");await studyFlowApi.backup.replaceAll(pendingImport);setPendingImport(null);await refresh();channelRef.current?.postMessage("changed");setNotice("导入成功")}catch(cause){setError(cause instanceof Error?cause.message:"导入失败，当前数据未改变")}}
 function navigate(next:Page){if(page==="focus")setLastPage(next);setPage(next)}
 if(loading)return <div className="loading-screen">
<BookOpen/>
<p>正在打开 StudyFlow…</p>
</div>;
 if(page==="focus"&&active)return <>
{error&&<div className="focus-alert alert error" role="alert"><span>{error}</span><button onClick={()=>setError("")}>×</button></div>}
{notice&&<div className="focus-alert alert success" role="status"><span>{notice}</span><button onClick={()=>setNotice("")}>×</button></div>}
<FocusPage session={active} activeInterval={activeInterval} settings={settings} seconds={displaySeconds} overtime={isPomodoroOvertime} estimateReached={estimateReached} onLeave={()=>setPage(lastPage)} onPause={()=>void mutate(()=>executionAdapter.pause(active))} onResume={()=>void mutate(()=>executionAdapter.resume(active))} onAdvance={action=>void mutate(()=>executionAdapter.advance(active,action))} onEditPomodoro={()=>setPomodoroEditOpen(true)} onFinish={()=>setFinishOpen(true)}/>{pomodoroEditOpen&&<SessionPomodoroSettingsModal session={active} onClose={()=>setPomodoroEditOpen(false)} onSave={updateSessionPomodoro}/>} {finishOpen&&<FinishSessionModal session={active} focusSeconds={focusSeconds} onClose={()=>setFinishOpen(false)} onFinish={finish}/>} {unresolved&&<SleepGapDialog session={active} gapSeconds={Math.max(0,(Date.parse(unresolved.gap.to)-Date.parse(unresolved.gap.from))/1000)} onResolve={async(resolution,correctedSeconds)=>{await mutate(()=>executionAdapter.resolveSleepGap(active,{intervalId:unresolved.interval.id,gapIndex:unresolved.index,resolution,correctedSeconds}))}}/>}</>;
 return <div className={`app-shell${active?" has-session":""}`}>
<aside className="sidebar">
<div className="brand">
<span>
<Leaf/>
</span>
<div>
<strong>StudyFlow</strong>
<small>计划 · 执行 · 记录</small>
</div>
</div>
<nav aria-label="主导航">
<Nav active={page==="today"} icon={<CalendarCheck/>} label="Today" onClick={()=>navigate("today")}/>
<Nav active={page==="plan"} icon={<LayoutGrid/>} label="Plan" onClick={()=>navigate("plan")}/>
<Nav active={page==="history"} icon={<History/>} label="History" onClick={()=>navigate("history")}/>
<Nav active={page==="categories"} icon={<Tags/>} label="Categories" onClick={()=>navigate("categories")}/>
<Nav active={page==="settings"} icon={<Settings/>} label="专注设置" onClick={()=>navigate("settings")}/>
</nav>
<button className="quick-start" onClick={()=>setStartContext({})}>
<Play/>开始学习</button>
<button className="data-button" onClick={()=>setBackupOpen(true)}>
<Database/>数据管理</button>
</aside>
<main className={`main-content page-${page}`}>{error&&<div className="alert error" role="alert">
<span>{error}</span>
<button onClick={()=>setError("")}>×</button>
</div>}{notice&&<div className="toast" role="status">
<span>{notice}</span>
<button onClick={()=>setNotice("")}>×</button>
</div>}{page==="today"&&<TodayPage tasks={tasks} categories={categories} sessions={sessions} sessionDurations={sessionDurations} now={now} onToggle={task=>void toggle(task)} onEdit={setEditingTask} onDelete={item=>setDeleteTarget({type:"task",item})} onNew={()=>setEditingTask(null)} onStart={task=>setStartContext({task})}/>} {page==="plan"&&<PlanPage tasks={tasks} categories={categories} onToggle={task=>void toggle(task)} onEdit={setEditingTask} onDelete={item=>setDeleteTarget({type:"task",item})} onNew={()=>setEditingTask(null)} onStart={task=>setStartContext({task})}/>} {page==="categories"&&<CategoriesPage tasks={tasks} categories={categories} onCreate={async name=>{await studyFlowApi.categories.create({name});await refresh()}} onUpdate={async(id,name)=>{await studyFlowApi.categories.update(id,{name});await refresh()}} onDelete={item=>setDeleteTarget({type:"category",item})}/>} {page==="history"&&<HistoryPage sessions={sessions} durations={sessionDurations} tasks={tasks} categories={categories} onRefresh={()=>void refresh()} onCorrect={setCorrecting}/>} {page==="settings"&&<ExecutionSettingsPage settings={settings} onPreviewSound={playNotificationSound} onSave={async value=>{const next=await executionAdapter.saveSettings(value);setSettings(next);channelRef.current?.postMessage("changed");if(next.notificationsEnabled&&"Notification" in window&&Notification.permission==="default")try{await Notification.requestPermission()}catch{/* 权限请求失败不影响已保存设置 */}}}/>}</main>{active&&<ActiveSessionBar session={active} seconds={focusSeconds} onFocus={()=>{setLastPage(page);setPage("focus")}} onPause={()=>void mutate(()=>executionAdapter.pause(active))} onResume={()=>void mutate(()=>executionAdapter.resume(active))} onFinish={()=>setFinishOpen(true)}/>} {startContext&&<StartSessionModal context={startContext} tasks={tasks} categories={categories} settings={settings} onClose={()=>setStartContext(null)} onStart={start}/>} {finishOpen&&active&&<FinishSessionModal session={active} focusSeconds={focusSeconds} onClose={()=>setFinishOpen(false)} onFinish={finish}/>} {unresolved&&active&&<SleepGapDialog session={active} gapSeconds={Math.max(0,(Date.parse(unresolved.gap.to)-Date.parse(unresolved.gap.from))/1000)} onResolve={async(resolution,correctedSeconds)=>{await mutate(()=>executionAdapter.resolveSleepGap(active,{intervalId:unresolved.interval.id,gapIndex:unresolved.index,resolution,correctedSeconds}))}}/>} {correcting&&<SessionCorrectionModal session={correcting} onClose={()=>setCorrecting(null)} onSave={async input=>{await executionAdapter.correct(correcting,input);setCorrecting(null);await refresh();channelRef.current?.postMessage("changed");setNotice("修正已保存，原始值已进入审计记录")}}/>} {editingTask!==undefined&&<TaskForm categories={categories} task={editingTask??undefined} onSubmit={saveTask} onClose={()=>setEditingTask(undefined)}/>} {deleteTarget&&<ConfirmDialog title={deleteTarget.type==="task"?"删除任务":"删除分类"} message="删除后不可在当前计划中恢复，但历史记录会保留。" onConfirm={()=>void confirmDelete()} onClose={()=>setDeleteTarget(null)}/>} {backupOpen&&<Modal title="数据管理" onClose={()=>setBackupOpen(false)}>
<div className="backup-panel">
<section>
<h3>导出完整备份</h3>
<p>保存计划和执行记录。</p>
<button className="button secondary" onClick={()=>void exportData()}>导出全部数据</button>
</section>
<section>
<h3>覆盖导入</h3>
<input ref={fileRef} hidden type="file" accept=".json" aria-label="导入备份文件" onChange={e=>void selectImport(e)}/>
<button className="button secondary" onClick={()=>fileRef.current?.click()}>选择备份文件</button>
</section>
</div>
</Modal>} {pendingImport!==null&&<Modal title="覆盖导入" onClose={()=>setPendingImport(null)}>
<p>当前数据将先自动备份，再被文件内容覆盖。</p>
<footer className="modal-actions">
<button className="button secondary" onClick={()=>setPendingImport(null)}>取消</button>
<button className="button danger" onClick={()=>void confirmImport()}>确认覆盖导入</button>
</footer>
</Modal>}</div>;
}
function Nav({active,icon,label,onClick}:{active:boolean;icon:ReactNode;label:string;onClick:()=>void}){return <a href={`#${label}`} className={active?"active":""} onClick={e=>{e.preventDefault();onClick()}}>{icon}{label}</a>}
