import { z } from "zod";

export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须为 YYYY-MM-DD");
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const timeZoneSchema = z.string().min(1).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "时区必须是有效的 IANA 时区名称");

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "任务标题不能为空").max(200),
  categoryId: z.string().min(1),
  estimatedMinutes: z.number().int().min(1).max(1440),
  dueDate: localDateSchema,
  important: z.boolean(),
  urgent: z.boolean(),
  completed: z.boolean(),
  completedAt: isoDateTimeSchema.nullable(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "分类名称不能为空").max(80),
  sortOrder: z.number().int().nonnegative(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const taskSnapshotSchema = taskSchema.pick({
  title: true,
  categoryId: true,
  estimatedMinutes: true,
  dueDate: true,
  important: true,
  urgent: true,
});

export const taskEventTypeSchema = z.enum(["created", "updated", "completed", "reopened", "archived"]);

export const taskEventSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  sequence: z.number().int().positive(),
  type: taskEventTypeSchema,
  occurredAt: isoDateTimeSchema,
  snapshot: taskSnapshotSchema,
});

export const createTaskInputSchema = taskSchema.pick({
  title: true,
  categoryId: true,
  estimatedMinutes: true,
  dueDate: true,
  important: true,
  urgent: true,
});

export const updateTaskInputSchema = createTaskInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "至少需要修改一个字段",
);

export const createCategoryInputSchema = categorySchema.pick({ name: true });
export const updateCategoryInputSchema = createCategoryInputSchema;

export const timerModeSchema = z.enum(["stopwatch", "pomodoro"]);
export const sessionStatusSchema = z.enum(["running", "paused", "awaiting-confirmation", "sleep-review", "finished"]);
export const sessionOutcomeSchema = z.enum(["completed", "partial", "unfinished"]);
export const intervalKindSchema = z.enum(["focus", "break"]);
export const failureReasonSchema = z.enum([
  "underestimated", "insufficient-time", "interrupted", "low-energy", "plan-changed", "other",
]);

export const pausePeriodSchema = z.object({
  startedAt: isoDateTimeSchema,
  endedAt: isoDateTimeSchema.nullable(),
}).superRefine((value, ctx) => {
  if (value.endedAt && Date.parse(value.endedAt) < Date.parse(value.startedAt)) {
    ctx.addIssue({ code: "custom", path: ["endedAt"], message: "暂停结束时间不能早于开始时间" });
  }
});

export const sleepGapSchema = z.object({
  detectedAt: isoDateTimeSchema,
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  resolution: z.enum(["include", "exclude", "correct"]).nullable(),
  correctedSeconds: z.number().int().nonnegative().nullable(),
  resumeStatus: z.enum(["running", "paused", "awaiting-confirmation"]),
}).superRefine((value, ctx) => {
  const durationSeconds = (Date.parse(value.to) - Date.parse(value.from)) / 1000;
  if (durationSeconds < 0) ctx.addIssue({ code: "custom", path: ["to"], message: "休眠结束时间不能早于开始时间" });
  if (value.resolution === "correct" && (value.correctedSeconds ?? 0) > durationSeconds) {
    ctx.addIssue({ code: "custom", path: ["correctedSeconds"], message: "修正时长不能超过休眠区间" });
  }
});

export const studyIntervalSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  kind: intervalKindSchema,
  pomodoroRound: z.number().int().positive().nullable(),
  targetSeconds: z.number().int().positive().nullable(),
  startedAt: isoDateTimeSchema,
  endedAt: isoDateTimeSchema.nullable(),
  pauses: z.array(pausePeriodSchema),
  sleepGaps: z.array(sleepGapSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).superRefine((value, ctx) => {
  const start = Date.parse(value.startedAt);
  const end = value.endedAt ? Date.parse(value.endedAt) : null;
  if (end !== null && end < start) ctx.addIssue({ code: "custom", path: ["endedAt"], message: "阶段结束时间不能早于开始时间" });
  const pauses = [...value.pauses].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  pauses.forEach((pause, index) => {
    const pauseStart = Date.parse(pause.startedAt);
    const pauseEnd = pause.endedAt ? Date.parse(pause.endedAt) : null;
    if (pauseStart < start || (end !== null && (pauseEnd ?? Number.POSITIVE_INFINITY) > end)) {
      ctx.addIssue({ code: "custom", path: ["pauses", index], message: "暂停区间必须位于所属阶段内" });
    }
    const previous = pauses[index - 1];
    if (previous && (!previous.endedAt || Date.parse(previous.endedAt) > pauseStart)) {
      ctx.addIssue({ code: "custom", path: ["pauses", index], message: "暂停区间不能重叠" });
    }
  });
  value.sleepGaps.forEach((gap, index) => {
    if (Date.parse(gap.from) < start || (end !== null && Date.parse(gap.to) > end)) {
      ctx.addIssue({ code: "custom", path: ["sleepGaps", index], message: "休眠区间必须位于所属阶段内" });
    }
  });
});

export const pomodoroSettingsSnapshotSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180), shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120), roundsPerSet: z.number().int().min(1).max(12),
});

export const studySessionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1).nullable(),
  categoryId: z.string().min(1),
  taskTitleSnapshot: z.string().trim().min(1).max(200),
  categoryNameSnapshot: z.string().trim().min(1).max(80),
  estimatedMinutesSnapshot: z.number().int().min(1).max(1440).nullable(),
  goal: z.string().trim().max(500),
  mode: timerModeSchema,
  pomodoroSettingsSnapshot: pomodoroSettingsSnapshotSchema.nullable(),
  status: sessionStatusSchema,
  activeIntervalId: z.string().min(1).nullable(),
  pomodoroRound: z.number().int().positive(),
  startedAt: isoDateTimeSchema,
  endedAt: isoDateTimeSchema.nullable(),
  timezone: timeZoneSchema,
  outcome: sessionOutcomeSchema.nullable(),
  failureReason: failureReasonSchema.nullable(),
  note: z.string().trim().max(2000),
  summary: z.string().trim().max(5000),
  revision: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const sessionRevisionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
  before: z.record(z.string(), z.unknown()),
  after: z.record(z.string(), z.unknown()),
  createdAt: isoDateTimeSchema,
});

export const executionSettingsSchema = z.object({
  id: z.literal("default"),
  focusMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120),
  roundsPerSet: z.number().int().min(1).max(12),
  soundEnabled: z.boolean(),
  soundVolume: z.number().int().min(10).max(100).default(80),
  notificationsEnabled: z.boolean(),
  stopwatchAutoPauseMinutes: z.number().int().min(60).max(1440),
  updatedAt: isoDateTimeSchema,
});

export const growthSourceTypeSchema = z.enum(["study", "meditation"]);
export const plantTypeSchema = z.enum(["tree", "flower"]);
export const growthRecordSchema = z.object({
  id: z.string().min(1),
  sourceType: growthSourceTypeSchema,
  sourceSessionId: z.string().min(1),
  plantType: plantTypeSchema,
  variant: z.number().int().min(0).max(2),
  targetSecondsSnapshot: z.number().int().positive(),
  localDate: localDateSchema,
  timezone: timeZoneSchema,
  createdAt: isoDateTimeSchema,
});

export const meditationModeSchema = z.enum(["timed", "free"]);
export const meditationStatusSchema = z.enum(["breathing", "running", "paused", "sleep-review", "finished"]);
export const meditationIntentionSchema = z.enum(["calm", "refocus", "observe", "self-care", "rest", "other"]);
export const breathingPatternSchema = z.enum(["4-7-8", "balanced", "box", "none"]);
export const meditationSessionSchema = z.object({
  id: z.string().min(1),
  mode: meditationModeSchema,
  status: meditationStatusSchema,
  intention: meditationIntentionSchema,
  intentionNote: z.string().trim().max(200),
  breathingPattern: breathingPatternSchema,
  breathingRounds: z.number().int().nonnegative().max(20),
  targetSeconds: z.number().int().positive().nullable(),
  activeIntervalId: z.string().min(1).nullable(),
  startedAt: isoDateTimeSchema,
  meditationStartedAt: isoDateTimeSchema.nullable(),
  endedAt: isoDateTimeSchema.nullable(),
  timezone: timeZoneSchema,
  feeling: z.number().int().min(1).max(5).nullable(),
  note: z.string().trim().max(2000),
  revision: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const meditationIntervalSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  kind: z.enum(["breathing", "meditation"]),
  targetSeconds: z.number().int().positive().nullable(),
  startedAt: isoDateTimeSchema,
  endedAt: isoDateTimeSchema.nullable(),
  pauses: z.array(pausePeriodSchema),
  sleepGaps: z.array(sleepGapSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const startSessionInputSchema = z.object({
  taskId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  goal: z.string().trim().max(500).default(""),
  timezone: timeZoneSchema,
  pomodoroSettings: pomodoroSettingsSnapshotSchema.optional(),
});

export const finishSessionInputSchema = z.object({
  outcome: sessionOutcomeSchema,
  failureReason: failureReasonSchema.nullable().default(null),
  note: z.string().trim().max(2000).default(""),
  summary: z.string().trim().max(5000).default(""),
  completeTask: z.boolean().default(false),
}).refine((v) => v.outcome === "completed" || v.failureReason !== null, "部分完成或未完成必须选择原因");

export type Task = z.infer<typeof taskSchema>;
export type Category = z.infer<typeof categorySchema>;
export type TaskEvent = z.infer<typeof taskEventSchema>;
export type TaskEventType = z.infer<typeof taskEventTypeSchema>;
export type TaskSnapshot = z.infer<typeof taskSnapshotSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type TimerMode = z.infer<typeof timerModeSchema>;
export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type SessionOutcome = z.infer<typeof sessionOutcomeSchema>;
export type FailureReason = z.infer<typeof failureReasonSchema>;
export type StudyInterval = z.infer<typeof studyIntervalSchema>;
export type StudySession = z.infer<typeof studySessionSchema>;
export type SessionRevision = z.infer<typeof sessionRevisionSchema>;
export type ExecutionSettings = z.infer<typeof executionSettingsSchema>;
export type PomodoroSettingsSnapshot = z.infer<typeof pomodoroSettingsSnapshotSchema>;
export type GrowthSourceType = z.infer<typeof growthSourceTypeSchema>;
export type PlantType = z.infer<typeof plantTypeSchema>;
export type GrowthRecord = z.infer<typeof growthRecordSchema>;
export type MeditationMode = z.infer<typeof meditationModeSchema>;
export type MeditationStatus = z.infer<typeof meditationStatusSchema>;
export type MeditationIntention = z.infer<typeof meditationIntentionSchema>;
export type BreathingPattern = z.infer<typeof breathingPatternSchema>;
export type MeditationSession = z.infer<typeof meditationSessionSchema>;
export type MeditationInterval = z.infer<typeof meditationIntervalSchema>;
export type StartSessionInput = z.input<typeof startSessionInputSchema>;
export type FinishSessionInput = z.input<typeof finishSessionInputSchema>;
