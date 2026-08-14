import { z } from "zod";
import { categorySchema, taskEventSchema, taskSchema } from "./models";

export const BACKUP_FORMAT = "studyflow-backup" as const;
export const BACKUP_VERSION = 1 as const;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  data: z.object({
    tasks: z.array(taskSchema),
    categories: z.array(categorySchema).min(1, "备份必须至少包含一个分类"),
    taskEvents: z.array(taskEventSchema),
  }),
});

export type StudyFlowBackup = z.infer<typeof backupSchema>;

