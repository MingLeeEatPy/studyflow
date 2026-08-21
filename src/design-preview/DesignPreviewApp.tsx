import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, Check, ChevronRight, Clock3, Flower2, History, LayoutGrid, Leaf, Monitor, MoreHorizontal, Pause, Play, Plus, RotateCcw, Settings, Smartphone, Sparkles, Sprout, Timer, TreePine } from "lucide-react";
import focusForest from "../assets/nature/focus-forest.webp";
import meditationWater from "../assets/nature/meditation-water.webp";
import { PlantIllustration } from "../components/PlantIllustration";
import "./design-preview.css";

type Screen = "today" | "plan" | "focus" | "meditation" | "growth";
type Device = "desktop" | "mobile";
const screens: { id: Screen; label: string }[] = [
  { id: "today", label: "Today" }, { id: "plan", label: "Plan" }, { id: "focus", label: "Focus" },
  { id: "meditation", label: "Meditation" }, { id: "growth", label: "成长阶段" },
];

const mockTasks = [
  { title: "高数：复习微分中值定理", category: "高数", time: "45 分钟", urgent: true, done: false },
  { title: "CS50 Week 4 笔记整理", category: "CS50", time: "35 分钟", urgent: false, done: false },
  { title: "线性代数习题 3.2", category: "线性代数", time: "30 分钟", urgent: false, done: true },
];

export function DesignPreviewApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initial = params.get("screen") as Screen | null;
  const [screen, setScreen] = useState<Screen>(screens.some(item => item.id === initial) ? initial! : "today");
  const [device, setDevice] = useState<Device>(params.get("device") === "mobile" ? "mobile" : "desktop");

  useEffect(() => {
    const next = new URL(window.location.href);
    next.searchParams.set("design-preview", "1"); next.searchParams.set("screen", screen); next.searchParams.set("device", device);
    window.history.replaceState(null, "", next);
  }, [screen, device]);

  return <div className="design-preview-root">
    <header className="preview-toolbar">
      <div className="preview-mark"><Leaf/><span><strong>StudyFlow</strong><small>Design preview · 假数据</small></span></div>
      <nav aria-label="样板页面">
        {screens.map(item => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>{item.label}</button>)}
      </nav>
      <div className="device-switch" aria-label="预览宽度">
        <button aria-label="桌面宽度" className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}><Monitor/></button>
        <button aria-label="手机宽度" className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}><Smartphone/></button>
      </div>
    </header>
    <div className={`preview-canvas device-${device}`}>
      <div className="preview-viewport">
        {screen === "today" && <TodayPreview onNavigate={setScreen}/>} 
        {screen === "plan" && <PlanPreview onNavigate={setScreen}/>} 
        {screen === "focus" && <FocusPreview/>}
        {screen === "meditation" && <MeditationPreview/>}
        {screen === "growth" && <GrowthPreview/>}
      </div>
    </div>
  </div>;
}

function AppFrame({ active, children, onNavigate }: { active: Screen; children: ReactNode; onNavigate: (page: Screen) => void }) {
  const nav = [
    ["today", <CalendarDays/>, "Today"], ["plan", <LayoutGrid/>, "Plan"], ["focus", <Timer/>, "Focus"],
    ["meditation", <Flower2/>, "Meditation"], ["growth", <Sprout/>, "成长"],
  ] as const;
  return <div className="preview-app light-scene">
    <aside className="preview-sidebar">
      <div className="app-brand"><span><Leaf/></span><div><strong>StudyFlow</strong><small>计划 · 执行 · 成长</small></div></div>
      <nav>{nav.map(([id, icon, label]) => <button key={id} className={active === id ? "active" : ""} onClick={() => onNavigate(id)}>{icon}<span>{label}</span></button>)}</nav>
      <div className="sidebar-spacer"/>
      <button><History/><span>History</span></button><button><Settings/><span>设置</span></button>
      <button className="sidebar-focus" onClick={() => onNavigate("focus")}><Play/><span>开始专注</span></button>
    </aside>
    <main>{children}</main>
    <nav className="mobile-nav" aria-label="移动导航">{nav.slice(0,4).map(([id,icon,label]) => <button key={id} className={active===id?"active":""} onClick={()=>onNavigate(id)}>{icon}<span>{label}</span></button>)}</nav>
  </div>;
}

function TodayPreview({ onNavigate }: { onNavigate: (page: Screen) => void }) {
  return <AppFrame active="today" onNavigate={onNavigate}>
    <div className="page-wrap today-preview">
      <PageHeader eyebrow="8月15日 · 星期六" title="今天，按自己的节奏前进" description="把注意力放在下一件真正重要的事上。"><button className="primary-action"><Plus/>新建任务</button></PageHeader>
      <section className="today-hero">
        <article className="glass-card stats-panel">
          <div className="section-heading"><div><small>今日计划</small><h2>2 小时 30 分</h2></div><span className="quiet-badge">稳定推进</span></div>
          <div className="progress-track"><span style={{width:"47%"}}/></div>
          <div className="stat-grid">
            <div><span>已完成</span><strong>45 分</strong></div><div><span>剩余</span><strong>1 小时 45 分</strong></div>
            <div><span>实际专注</span><strong>1 小时 11 分</strong></div><div><span>完成任务</span><strong>1 / 3</strong></div>
          </div>
          <button className="active-session-card" onClick={() => onNavigate("focus")}><span className="pulse-dot"/><span><small>正在专注</small><strong>高数：微分中值定理</strong></span><b>18:42</b><ChevronRight/></button>
        </article>
        <article className="glass-card garden-panel">
          <div className="section-heading"><div><small>今日花园</small><h2>专注留下的痕迹</h2></div><button className="icon-button" aria-label="查看更多"><MoreHorizontal/></button></div>
          <div className="mini-garden">
            <div className="garden-ground"/>
            <div className="garden-plant tree-a"><PlantIllustration kind="tree" stage={4} variant={0}/></div>
            <div className="garden-plant flower-a"><PlantIllustration kind="flower" stage={4} variant={1}/></div>
            <div className="garden-plant tree-b"><PlantIllustration kind="tree" stage={2} variant={2}/></div>
          </div>
          <p>今天已种下 3 株植物 · 其中 1 次冥想</p>
        </article>
      </section>
      <section className="task-section"><div className="section-title"><div><h2>今日任务</h2><p>截止今天与已经逾期的任务</p></div><button className="text-action">查看计划 <ChevronRight/></button></div>
        <div className="task-list">{mockTasks.map((task,index) => <TaskRow key={task.title} task={task} index={index}/>)}</div>
      </section>
    </div>
  </AppFrame>;
}

function PlanPreview({ onNavigate }: { onNavigate: (page: Screen) => void }) {
  const quadrants = [
    ["重要且紧急", "优先处理", "urgent", mockTasks.slice(0,1)], ["重要但不紧急", "持续投入", "important", mockTasks.slice(1,2)],
    ["不重要但紧急", "尽快安排", "prompt", [{...mockTasks[2], done:false}]], ["不重要且不紧急", "有余力再做", "later", []],
  ] as const;
  return <AppFrame active="plan" onNavigate={onNavigate}><div className="page-wrap plan-preview">
    <PageHeader eyebrow="计划视图" title="把精力放在真正重要的地方" description="四象限帮助你看清优先级，而不是制造更多压力。"><button className="primary-action"><Plus/>新建任务</button></PageHeader>
    <div className="glass-toolbar"><div className="segmented"><button className="active"><LayoutGrid/>四象限</button><button><BookOpen/>列表</button></div><div className="filter-chips"><button className="active">全部分类</button><button>未完成</button><button>截止日期</button></div></div>
    <section className="quadrant-grid">{quadrants.map(([title, hint, tone, tasks]) => <article key={title} className={`quadrant ${tone}`}><header><div><span className="quadrant-dot"/><h2>{title}</h2></div><small>{hint} · {tasks.length}</small></header><div className="quadrant-tasks">{tasks.map((task,index)=><TaskRow key={task.title} task={task} index={index} compact/>)}{tasks.length===0&&<div className="empty-quadrant"><Leaf/><span>这里暂时很安静</span></div>}</div></article>)}</section>
  </div></AppFrame>;
}

function FocusPreview() {
  const [state,setState]=useState<"running"|"paused"|"overtime">("running");
  const [progress,setProgress]=useState(72);
  const stage = progress < 10 ? 0 : progress < 35 ? 1 : progress < 65 ? 2 : progress < 100 ? 3 : 4;
  return <div className={`immersive-scene focus-scene focus-${state}`} style={{backgroundImage:`linear-gradient(180deg,rgba(10,25,20,.47),rgba(8,19,16,.76)),url(${focusForest})`}}>
    <div className="immersive-top"><button className="glass-icon"><ChevronRight className="back-icon"/></button><div><Leaf/><span>StudyFlow · Focus</span></div><button className="glass-icon"><MoreHorizontal/></button></div>
    <div className="focus-center">
      <div className="ambient-orb"/><div className="hero-plant"><PlantIllustration kind="tree" stage={stage} variant={0} overtime={state==="overtime"}/></div>
      <section className="dark-glass focus-controls">
        <div className="focus-meta"><span>{state==="overtime"?"本轮已完成 · 超时专注":state==="paused"?"已暂停 · 植物也在休息":"第 2 轮 · 正在生长"}</span><span>高数</span></div>
        <h1>复习微分中值定理</h1><div className={`timer-display ${state==="overtime"?"warm":""}`}>{state==="overtime"?"+ 06:18":"18:42"}</div>
        <div className="focus-progress"><span style={{width:`${Math.min(progress,100)}%`}}/></div><p>目标 25 分钟 · 已生长 {Math.min(progress,100)}%</p>
        <div className="focus-actions"><button className="soft-button" onClick={()=>setState("running")}><RotateCcw/>继续</button><button className="main-round" onClick={()=>setState(state==="paused"?"running":"paused")}>{state==="paused"?<Play/>:<Pause/>}</button><button className="soft-button" onClick={()=>setState("overtime")}><Check/>结束</button></div>
      </section>
    </div>
    <div className="preview-state-panel"><span>交互状态</span><button className={state==="running"?"active":""} onClick={()=>setState("running")}>运行</button><button className={state==="paused"?"active":""} onClick={()=>setState("paused")}>暂停</button><button className={state==="overtime"?"active":""} onClick={()=>{setState("overtime");setProgress(112)}}>超时</button><label>成长 <input aria-label="成长比例" type="range" min="0" max="120" value={progress} onChange={e=>setProgress(Number(e.target.value))}/></label></div>
  </div>;
}

function MeditationPreview() {
  const [phase,setPhase]=useState<"setup"|"breathing"|"timer"|"review">("setup");
  const [breath,setBreath]=useState("4-7-8"); const [duration,setDuration]=useState(10); const [paused,setPaused]=useState(false);
  return <div className="immersive-scene meditation-scene" style={{backgroundImage:`linear-gradient(180deg,rgba(18,36,30,.34),rgba(12,27,23,.72)),url(${meditationWater})`}}>
    <div className="immersive-top"><button className="glass-icon"><ChevronRight className="back-icon"/></button><div><Flower2/><span>StudyFlow · Meditation</span></div><button className="glass-icon"><MoreHorizontal/></button></div>
    {phase==="setup"&&<section className="dark-glass meditation-setup"><div className="setup-copy"><small>给自己一点空间</small><h1>此刻，你需要怎样的停留？</h1><p>冥想不是要清空思绪，而是温柔地看见它们。</p></div><div className="setup-grid"><div><label>时长</label><div className="choice-row">{[5,10,15,20,30].map(value=><button key={value} className={duration===value?"active":""} onClick={()=>setDuration(value)}>{value}<small>分钟</small></button>)}<button onClick={()=>setDuration(0)} className={duration===0?"active":""}>自由<small>计时</small></button></div></div><div><label>此刻的意图</label><div className="chip-row"><button className="active">恢复专注</button><button>平静</button><button>观察情绪</button><button>自我关怀</button><button>休息</button></div></div><div><label>呼吸引导</label><div className="breath-options">{[["4-7-8","4-7-8","4 轮"],["4-4","均衡呼吸","8 轮"],["box","箱式呼吸","4 轮"],["none","不使用引导",""]].map(([id,name,rounds])=><button key={id} className={breath===id?"active":""} onClick={()=>setBreath(id)}><span>{name}</span><small>{rounds}</small></button>)}</div></div></div><button className="meditation-start" onClick={()=>setPhase(breath==="none"?"timer":"breathing")}><Play/>开始这次停留</button></section>}
    {phase==="breathing"&&<div className="meditation-center"><div className="breathing-halo"><span>吸气</span><small>4</small></div><p>让气息自然进入，不必用力。</p><div className="breath-progress"><span className="active"/><span/><span/><span/></div><button className="glass-text-button" onClick={()=>setPhase("timer")}>跳过呼吸引导</button></div>}
    {phase==="timer"&&<div className="meditation-center timer-phase"><div className="hero-flower"><PlantIllustration kind="flower" stage={3} variant={1}/></div><section className="dark-glass meditation-timer"><span>{paused?"已暂停":"安静地停留"}</span><strong>{duration===0?"12:08":"08:36"}</strong><small>{duration===0?"自由冥想":"剩余时间"}</small><div><button className="soft-button"><Sparkles/>结束</button><button className="main-round" onClick={()=>setPaused(!paused)}>{paused?<Play/>:<Pause/>}</button><button className="soft-button" onClick={()=>setPhase("review")}><Check/>完成</button></div></section></div>}
    {phase==="review"&&<section className="dark-glass meditation-review"><PlantIllustration kind="flower" stage={4} variant={1}/><small>这次停留已经被好好保存</small><h1>现在感觉如何？</h1><div className="feeling-row"><button>很疲惫</button><button>有些沉重</button><button className="active">平静</button><button>轻松</button><button>很有能量</button></div><textarea aria-label="冥想备注" placeholder="写下一点感受，也可以留空…"/><div><button className="glass-text-button">跳过复盘并保存</button><button className="meditation-start">保存这次冥想</button></div></section>}
    <div className="preview-state-panel meditation-state"><span>流程预览</span><button className={phase==="setup"?"active":""} onClick={()=>setPhase("setup")}>设置</button><button className={phase==="breathing"?"active":""} onClick={()=>setPhase("breathing")}>呼吸</button><button className={phase==="timer"?"active":""} onClick={()=>setPhase("timer")}>冥想</button><button className={phase==="review"?"active":""} onClick={()=>setPhase("review")}>复盘</button></div>
  </div>;
}

function GrowthPreview() {
  const labels=["种子 · <10%","嫩芽 · 10–34%","幼苗 · 35–64%","小树 / 花苞 · 65–99%","成熟 / 盛开 · ≥100%"];
  return <div className="growth-preview"><header><small>StudyFlow Growth System</small><h1>成长不是奖励，而是时间留下的形状</h1><p>每次有效专注或冥想生成一株植物。提前结束不会枯萎，它会停留在真实达到的阶段。</p></header><div className="growth-board"><section><div className="growth-title"><TreePine/><div><h2>学习 · 树</h2><p>自由正计时以 25 分钟为成长基准</p></div></div><div className="stage-row">{labels.map((label,index)=><article key={label}><PlantIllustration kind="tree" stage={index as 0|1|2|3|4} variant={index}/><strong>{label.split(" · ")[0]}</strong><small>{label.split(" · ")[1]}</small></article>)}</div></section><section><div className="growth-title"><Flower2/><div><h2>冥想 · 花</h2><p>呼吸引导不计入花朵成熟时间</p></div></div><div className="stage-row">{labels.map((label,index)=><article key={label}><PlantIllustration kind="flower" stage={index as 0|1|2|3|4} variant={index+1}/><strong>{index===3?"花苞":label.split(" · ")[0]}</strong><small>{label.split(" · ")[1]}</small></article>)}</div></section></div><div className="growth-note"><Leaf/><span><strong>克制的变化</strong>成熟后，超时只增加少量叶片或柔光，不制造金币、连击或强制奖励。</span></div></div>;
}

function PageHeader({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children:ReactNode}) { return <header className="page-header"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>{children}</header> }
function TaskRow({task,index,compact=false}:{task:typeof mockTasks[number];index:number;compact?:boolean}) { return <article className={`preview-task${task.done?" done":""}${compact?" compact":""}`}><button className="task-check" aria-label={task.done?"标记未完成":"标记完成"}>{task.done?<Check/>:null}</button><div><h3>{task.title}</h3><p><span className={`category-tag tag-${index%3}`}>{task.category}</span><span><Clock3/>{task.time}</span>{task.urgent&&<span className="urgent-label">今天截止</span>}</p></div><button className="task-play" aria-label="开始学习"><Play/></button></article> }
