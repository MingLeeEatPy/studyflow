import type { MeditationSession, GrowthRecord, StudySession } from "../../shared/schemas/models";
import { formatDuration } from "../features/executionAdapter";
import { PlantIllustration } from "./PlantIllustration";
import { buildGardenEntries } from "../domain/garden";

export function GrowthGarden({ records, sessions, durations, meditationSessions, meditationDurations }: {
  records: GrowthRecord[];
  sessions: StudySession[];
  durations: Record<string, number>;
  meditationSessions: MeditationSession[];
  meditationDurations: Record<string, number>;
}) {
  const entries = buildGardenEntries(records, sessions, durations, meditationSessions, meditationDurations);
  const groups = entries.reduce((result, entry) => {
    const group = result.get(entry.localDate) ?? [];
    group.push(entry); result.set(entry.localDate, group); return result;
  }, new Map<string, typeof entries>());
  return <section className="history-garden" aria-label="成长花园">
    <header className="history-garden-header"><div><p className="eyebrow">Growth Garden</p><h2>时间留下的花与树</h2><p>每一株植物都来自一次真实的学习或冥想投入。</p></div><strong>{entries.length} 株植物</strong></header>
    {entries.length === 0 ? <div className="empty-state"><span>✿</span><h3>花园还没有植物</h3><p>完成至少 1 分钟的学习或冥想后，第一株植物会在这里生长。</p></div> : <div className="history-garden-groups">{Array.from(groups.entries()).map(([date, items]) => <section className="history-garden-day" key={date}><h3>{formatGardenDate(date)}</h3><div className="history-garden-grid">{items.map((entry) => <article className="history-garden-plant" key={entry.record.id}><div className="history-garden-illustration" style={{ width: `${104 + entry.stage * 20}px`, height: `${104 + entry.stage * 20}px` }}><PlantIllustration kind={entry.record.plantType} stage={entry.stage} variant={entry.record.variant}/></div><h4>{entry.title}</h4><p>{entry.subtitle} · {formatDuration(entry.durationSeconds)}</p><small>{entry.record.plantType === "tree" ? "学习树" : "冥想花"} · {plantStageLabel(entry.stage)}</small></article>)}</div></section>)}</div>}
  </section>;
}

function formatGardenDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date);
}

function plantStageLabel(stage: 0 | 1 | 2 | 3 | 4): string {
  return ["种子", "嫩芽", "幼苗", "花苞 / 小树", "盛开的花 / 成熟树"][stage];
}
