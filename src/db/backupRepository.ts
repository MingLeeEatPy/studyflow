import type { StudyFlowDatabase } from "./database";
import { db, defaultExecutionSettings } from "./database";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupSchema,
  backupV2Schema,
  type StudyFlowBackup,
} from "../../shared/schemas/backup";

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
    const [tasks, categories, taskEvents, studySessions, studyIntervals, sessionRevisions, executionSettings] = await Promise.all([
      this.database.tasks.toArray(),
      this.database.categories.toArray(),
      this.database.taskEvents.toArray(),
      this.database.studySessions.toArray(), this.database.studyIntervals.toArray(),
      this.database.sessionRevisions.toArray(), this.database.executionSettings.get("default"),
    ]);
    return backupV2Schema.parse({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { tasks, categories, taskEvents, studySessions, studyIntervals, sessionRevisions,
        executionSettings: executionSettings ?? defaultExecutionSettings() },
    });
  }

  parse(input: unknown) {
    return backupSchema.parse(input);
  }

  async replaceAll(input: unknown): Promise<void> {
    const parsed = this.parse(input);
    const backup = parsed.version === 2 ? parsed : backupV2Schema.parse({ ...parsed, version: 2, data: {
      ...parsed.data, studySessions: [], studyIntervals: [], sessionRevisions: [],
      executionSettings: defaultExecutionSettings(),
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
    if (activeCount > 1) throw new Error("备份包含多个进行中的学习会话");

    await this.database.transaction(
      "rw",
      [this.database.tasks, this.database.categories, this.database.taskEvents, this.database.studySessions,
        this.database.studyIntervals, this.database.sessionRevisions, this.database.executionSettings],
      async () => {
        await Promise.all([
          this.database.tasks.clear(),
          this.database.categories.clear(),
          this.database.taskEvents.clear(),
          this.database.studySessions.clear(), this.database.studyIntervals.clear(), this.database.sessionRevisions.clear(), this.database.executionSettings.clear(),
        ]);
        await this.database.categories.bulkAdd(backup.data.categories);
        await this.database.tasks.bulkAdd(backup.data.tasks);
        await this.database.taskEvents.bulkAdd(backup.data.taskEvents);
        await this.database.studySessions.bulkAdd(backup.data.studySessions);
        await this.database.studyIntervals.bulkAdd(backup.data.studyIntervals);
        await this.database.sessionRevisions.bulkAdd(backup.data.sessionRevisions);
        await this.database.executionSettings.put(backup.data.executionSettings);
      },
    );
  }
}

export const backupRepository = new BackupRepository();
