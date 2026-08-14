import type { StudyFlowDatabase } from "./database";
import { db } from "./database";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupSchema,
  type StudyFlowBackup,
} from "../../shared/schemas/backup";

export class BackupRepository {
  constructor(private readonly database: StudyFlowDatabase = db) {}

  async exportData(): Promise<StudyFlowBackup> {
    const [tasks, categories, taskEvents] = await Promise.all([
      this.database.tasks.toArray(),
      this.database.categories.toArray(),
      this.database.taskEvents.toArray(),
    ]);
    return backupSchema.parse({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { tasks, categories, taskEvents },
    });
  }

  parse(input: unknown): StudyFlowBackup {
    return backupSchema.parse(input);
  }

  async replaceAll(input: unknown): Promise<void> {
    const backup = this.parse(input);
    const categoryIds = new Set(backup.data.categories.map((category) => category.id));
    if (backup.data.tasks.some((task) => !categoryIds.has(task.categoryId))) {
      throw new Error("备份包含引用不存在分类的任务");
    }
    const taskIds = new Set(backup.data.tasks.map((task) => task.id));
    if (backup.data.taskEvents.some((event) => !taskIds.has(event.taskId))) {
      throw new Error("备份包含引用不存在任务的历史事件");
    }

    await this.database.transaction(
      "rw",
      this.database.tasks,
      this.database.categories,
      this.database.taskEvents,
      async () => {
        await Promise.all([
          this.database.tasks.clear(),
          this.database.categories.clear(),
          this.database.taskEvents.clear(),
        ]);
        await this.database.categories.bulkAdd(backup.data.categories);
        await this.database.tasks.bulkAdd(backup.data.tasks);
        await this.database.taskEvents.bulkAdd(backup.data.taskEvents);
      },
    );
  }
}

export const backupRepository = new BackupRepository();

