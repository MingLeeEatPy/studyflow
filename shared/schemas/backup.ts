import { z } from "zod";
import {
  categorySchema,
  executionSettingsSchema,
  growthRecordSchema,
  meditationIntervalSchema,
  meditationSessionSchema,
  sessionRevisionSchema,
  studyIntervalSchema,
  studySessionSchema,
  taskEventSchema,
  taskSchema,
  planningPeriodSchema,
  dailyReviewSchema,
} from "./models";

export const BACKUP_FORMAT = "studyflow-backup" as const;
export const BACKUP_VERSION = 5 as const;

const commonDataSchema = z.object({
  tasks: z.array(taskSchema), categories: z.array(categorySchema).min(1, "备份必须至少包含一个分类"), taskEvents: z.array(taskEventSchema),
});
export const backupV1Schema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  data: commonDataSchema,
});
export const backupV2Schema = z.object({
  format: z.literal(BACKUP_FORMAT), version: z.literal(2), exportedAt: z.string().datetime({ offset: true }),
  data: commonDataSchema.extend({ studySessions: z.array(studySessionSchema), studyIntervals: z.array(studyIntervalSchema),
    sessionRevisions: z.array(sessionRevisionSchema), executionSettings: executionSettingsSchema }),
});
export const backupV3Schema = z.object({
  format: z.literal(BACKUP_FORMAT), version: z.literal(3), exportedAt: z.string().datetime({ offset: true }),
  data: commonDataSchema.extend({
    studySessions: z.array(studySessionSchema), studyIntervals: z.array(studyIntervalSchema),
    sessionRevisions: z.array(sessionRevisionSchema), executionSettings: executionSettingsSchema,
    growthRecords: z.array(growthRecordSchema), meditationSessions: z.array(meditationSessionSchema),
    meditationIntervals: z.array(meditationIntervalSchema),
  }),
});
export const backupV4Schema = z.object({
  format: z.literal(BACKUP_FORMAT), version: z.literal(4), exportedAt: z.string().datetime({ offset: true }),
  data: backupV3Schema.shape.data.extend({ planningPeriods: z.array(planningPeriodSchema) }),
});
export const backupV5Schema = z.object({
  format: z.literal(BACKUP_FORMAT), version: z.literal(5), exportedAt: z.string().datetime({ offset: true }),
  data: backupV4Schema.shape.data.extend({ dailyReviews: z.array(dailyReviewSchema) }),
});
export const backupSchema = z.discriminatedUnion("version", [backupV1Schema, backupV2Schema, backupV3Schema, backupV4Schema, backupV5Schema]);
export type StudyFlowBackup = z.infer<typeof backupV5Schema>;
export type CompatibleStudyFlowBackup = z.infer<typeof backupSchema>;
