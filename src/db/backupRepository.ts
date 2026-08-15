import type { StudyFlowDatabase } from "./database";
import { db, defaultExecutionSettings } from "./database";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupSchema,
  backupV3Schema,
  type StudyFlowBackup,
} from "../../shared/schemas/backup";
import { intervalActiveMs, totalFocusMs } from "../domain/execution";
import {
  localDateInTimezone,
  meditationGrowthTargetSeconds,
  stablePlantVariant,
  studyGrowthTargetSeconds,
} from "../domain/growth";
import { studyIntervalSchema, studySessionSchema } from "../../shared/schemas/models";

export class BackupRepository {
  constructor(private readonly database: StudyFlowDatabase = db) {}

  async exportData(): Promise<StudyFlowBackup> {
    if (!(await this.database.executionSettings.get("default"))) {
      await this.database.executionSettings.put(defaultExecutionSettings());
    }
    const active = await this.database.studySessions.where("status").anyOf("running", "paused", "awaiting-confirmation", "sleep-review").first();
    if (active?.status === "running" && active.activeIntervalId) {
      await this.database.transaction("rw", this.database.studySessions, this.database.studyIntervals, async () => {
        const current = await this.database.studySessions.get(active.id);
        if (!current || current.status !== "running" || current.revision !== active.revision || !current.activeIntervalId) return;
        const now = new Date().toISOString();
        const interval = await this.database.studyIntervals.get(current.activeIntervalId);
        if (interval) {
          interval.pauses.push({ startedAt: now, endedAt: null }); interval.updatedAt = now;
          await this.database.studyIntervals.put(interval);
        }
        await this.database.studySessions.update(current.id, { status: "paused", revision: current.revision + 1, updatedAt: now });
      });
    }
    const [tasks, categories, taskEvents, studySessions, studyIntervals, sessionRevisions, executionSettings, growthRecords, meditationSessions, meditationIntervals] = await Promise.all([
      this.database.tasks.toArray(),
      this.database.categories.toArray(),
      this.database.taskEvents.toArray(),
      this.database.studySessions.toArray(), this.database.studyIntervals.toArray(),
      this.database.sessionRevisions.toArray(), this.database.executionSettings.get("default"),
      this.database.growthRecords.toArray(), this.database.meditationSessions.toArray(), this.database.meditationIntervals.toArray(),
    ]);
    return backupV3Schema.parse({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { tasks, categories, taskEvents, studySessions, studyIntervals, sessionRevisions,
        executionSettings: executionSettings ?? defaultExecutionSettings(), growthRecords, meditationSessions, meditationIntervals },
    });
  }

  parse(input: unknown) {
    return backupSchema.parse(input);
  }

  async replaceAll(input: unknown): Promise<void> {
    const parsed = this.parse(input);
    const executionData = parsed.version === 1 ? {
      ...parsed.data, studySessions: [], studyIntervals: [], sessionRevisions: [],
      executionSettings: defaultExecutionSettings(),
    } : parsed.data;
    const backup = parsed.version === 3 ? parsed : backupV3Schema.parse({ ...parsed, version: 3, data: {
      ...executionData, growthRecords: [], meditationSessions: [], meditationIntervals: [],
    }});
    const categoryIds = new Set(backup.data.categories.map((category) => category.id));
    if (backup.data.tasks.some((task) => !categoryIds.has(task.categoryId))) {
      throw new Error("备份包含引用不存在分类的任务");
    }
    const taskIds = new Set(backup.data.tasks.map((task) => task.id));
    if (backup.data.taskEvents.some((event) => !taskIds.has(event.taskId))) {
      throw new Error("备份包含引用不存在任务的历史事件");
    }
    const sessionIds = new Set(backup.data.studySessions.map((session) => session.id));
    if (backup.data.studyIntervals.some((item) => !sessionIds.has(item.sessionId)) || backup.data.sessionRevisions.some((item) => !sessionIds.has(item.sessionId))) {
      throw new Error("备份包含引用不存在学习会话的执行记录");
    }
    if (backup.data.studySessions.some((item) => !categoryIds.has(item.categoryId) || (item.taskId !== null && !taskIds.has(item.taskId)))) {
      throw new Error("备份包含引用不存在任务或分类的学习会话");
    }
    const intervalById = new Map(backup.data.studyIntervals.map((item) => [item.id, item]));
    if (backup.data.studySessions.some((session) => session.activeIntervalId !== null && intervalById.get(session.activeIntervalId)?.sessionId !== session.id)) {
      throw new Error("备份包含无效的当前计时阶段引用");
    }
    const activeCount = backup.data.studySessions.filter((session) => session.status !== "finished").length;
    const meditationIds = new Set(backup.data.meditationSessions.map((session) => session.id));
    if (backup.data.meditationIntervals.some((item) => !meditationIds.has(item.sessionId))) {
      throw new Error("备份包含引用不存在冥想会话的阶段记录");
    }
    const meditationIntervalById = new Map(backup.data.meditationIntervals.map((item) => [item.id, item]));
    if (backup.data.meditationSessions.some((session) => session.activeIntervalId !== null
      && meditationIntervalById.get(session.activeIntervalId)?.sessionId !== session.id)) {
      throw new Error("备份包含无效的冥想计时阶段引用");
    }
    const growthSources = new Set<string>();
    for (const record of backup.data.growthRecords) {
      const validSource = record.sourceType === "study" ? sessionIds.has(record.sourceSessionId) : meditationIds.has(record.sourceSessionId);
      if (!validSource) throw new Error("备份包含引用不存在会话的成长记录");
      if (growthSources.has(record.sourceSessionId)) throw new Error("同一会话不能生成多条成长记录");
      growthSources.add(record.sourceSessionId);
      if (record.sourceType === "study") {
        const source = backup.data.studySessions.find((session) => session.id === record.sourceSessionId)!;
        const sourceIntervals = backup.data.studyIntervals.filter((interval) => interval.sessionId === source.id);
        if (source.status !== "finished" || !source.endedAt || sourceIntervals.some((interval) => !interval.endedAt)
          || !this.studyGrowthWasEarned(backup, source, sourceIntervals)) {
          throw new Error("学习成长记录必须来自至少 1 分钟的已结束会话");
        }
        if (record.plantType !== "tree" || record.targetSecondsSnapshot !== studyGrowthTargetSeconds(source)) {
          throw new Error("学习成长记录的植物类型或目标快照无效");
        }
        this.validateGrowthIdentity(record, source.id, source.timezone, source.endedAt);
      } else {
        const source = backup.data.meditationSessions.find((session) => session.id === record.sourceSessionId)!;
        const effective = backup.data.meditationIntervals.filter((interval) => interval.sessionId === source.id && interval.kind === "meditation")
          .reduce((sum, interval) => sum + intervalActiveMs(interval), 0);
        const sourceIntervals = backup.data.meditationIntervals.filter((interval) => interval.sessionId === source.id);
        if (source.status !== "finished" || !source.endedAt || sourceIntervals.some((interval) => !interval.endedAt)
          || effective < 60_000) {
          throw new Error("冥想成长记录必须来自至少 1 分钟的已结束会话");
        }
        if (record.plantType !== "flower" || record.targetSecondsSnapshot !== meditationGrowthTargetSeconds(source)) {
          throw new Error("冥想成长记录的植物类型或目标快照无效");
        }
        this.validateGrowthIdentity(record, source.id, source.timezone, source.endedAt);
      }
    }
    const meditationActiveCount = backup.data.meditationSessions.filter((session) => session.status !== "finished").length;
    if (activeCount + meditationActiveCount > 1) throw new Error("备份包含多个进行中的会话");

    await this.database.transaction(
      "rw",
      [this.database.tasks, this.database.categories, this.database.taskEvents, this.database.studySessions,
        this.database.studyIntervals, this.database.sessionRevisions, this.database.executionSettings,
        this.database.growthRecords, this.database.meditationSessions, this.database.meditationIntervals],
      async () => {
        await Promise.all([
          this.database.tasks.clear(),
          this.database.categories.clear(),
          this.database.taskEvents.clear(),
          this.database.studySessions.clear(), this.database.studyIntervals.clear(), this.database.sessionRevisions.clear(), this.database.executionSettings.clear(),
          this.database.growthRecords.clear(), this.database.meditationSessions.clear(), this.database.meditationIntervals.clear(),
        ]);
        await this.database.categories.bulkAdd(backup.data.categories);
        await this.database.tasks.bulkAdd(backup.data.tasks);
        await this.database.taskEvents.bulkAdd(backup.data.taskEvents);
        await this.database.studySessions.bulkAdd(backup.data.studySessions);
        await this.database.studyIntervals.bulkAdd(backup.data.studyIntervals);
        await this.database.sessionRevisions.bulkAdd(backup.data.sessionRevisions);
        await this.database.executionSettings.put(backup.data.executionSettings);
        await this.database.growthRecords.bulkAdd(backup.data.growthRecords);
        await this.database.meditationSessions.bulkAdd(backup.data.meditationSessions);
        await this.database.meditationIntervals.bulkAdd(backup.data.meditationIntervals);
      },
    );
  }

  private validateGrowthIdentity(
    record: StudyFlowBackup["data"]["growthRecords"][number],
    sourceSessionId: string,
    timezone: string,
    endedAt: string,
  ): void {
    if (record.variant !== stablePlantVariant(sourceSessionId)
      || record.timezone !== timezone
      || record.createdAt !== endedAt
      || record.localDate !== localDateInTimezone(endedAt, timezone)) {
      throw new Error("成长记录的稳定变体、日期或时区快照无效");
    }
  }

  private studyGrowthWasEarned(
    backup: StudyFlowBackup,
    source: StudyFlowBackup["data"]["studySessions"][number],
    currentIntervals: StudyFlowBackup["data"]["studyIntervals"],
  ): boolean {
    let cursorSession = source;
    let cursorIntervals = currentIntervals;
    const revisions = backup.data.sessionRevisions.filter((revision) => revision.sessionId === source.id);
    const maximumSteps = revisions.length;
    for (let step = 0; step <= maximumSteps; step += 1) {
      if (totalFocusMs(cursorIntervals) >= 60_000) return true;
      const link = revisions.find((revision) => {
        const after = revision.after as { session?: unknown; intervals?: unknown };
        const afterSession = studySessionSchema.safeParse(after.session);
        const afterIntervals = studyIntervalSchema.array().safeParse(after.intervals);
        return afterSession.success && afterIntervals.success
          && this.sameSessionState(afterSession.data, cursorSession)
          && this.sameTimeline(afterIntervals.data, cursorIntervals);
      });
      if (!link) return false;
      const before = link.before as { session?: unknown; intervals?: unknown };
      const after = link.after as { session?: unknown; intervals?: unknown };
      const beforeSession = studySessionSchema.safeParse(before.session);
      const beforeIntervals = studyIntervalSchema.array().safeParse(before.intervals);
      const afterSession = studySessionSchema.parse(after.session);
      const afterIntervals = studyIntervalSchema.array().parse(after.intervals);
      if (!beforeSession.success || !beforeIntervals.success
        || beforeSession.data.id !== source.id || afterSession.id !== source.id
        || beforeSession.data.status !== "finished" || afterSession.status !== "finished"
        || afterSession.revision !== beforeSession.data.revision + 1
        || !beforeIntervals.data.every((interval) => interval.sessionId === source.id && interval.endedAt !== null)
        || !afterIntervals.every((interval) => interval.sessionId === source.id && interval.endedAt !== null)
        || !this.sameIntervalIds(beforeIntervals.data, afterIntervals)) return false;
      cursorSession = beforeSession.data;
      cursorIntervals = beforeIntervals.data;
      revisions.splice(revisions.indexOf(link), 1);
    }
    return false;
  }

  private sameSessionState(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private sameTimeline(left: StudyFlowBackup["data"]["studyIntervals"], right: StudyFlowBackup["data"]["studyIntervals"]): boolean {
    const ordered = (items: StudyFlowBackup["data"]["studyIntervals"]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
  }

  private sameIntervalIds(left: StudyFlowBackup["data"]["studyIntervals"], right: StudyFlowBackup["data"]["studyIntervals"]): boolean {
    return left.length === right.length
      && [...left].map((interval) => interval.id).sort().join("\n") === [...right].map((interval) => interval.id).sort().join("\n");
  }
}

export const backupRepository = new BackupRepository();
