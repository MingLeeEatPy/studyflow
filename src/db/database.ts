import Dexie, { type Table } from "dexie";
import type {
  Category,
  ExecutionSettings,
  GrowthRecord,
  MeditationInterval,
  MeditationSession,
  SessionRevision,
  StudyInterval,
  StudySession,
  Task,
  TaskEvent,
  PlanningPeriod,
  DailyReview,
  WeeklyWorkloadPlan,
  SyncChange,
} from "../domain/models";

export const DEFAULT_CATEGORY_NAMES = ["高数", "线性代数", "C", "CS50", "其他"] as const;

function createId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export class StudyFlowDatabase extends Dexie {
  tasks!: Table<Task, string>;
  categories!: Table<Category, string>;
  taskEvents!: Table<TaskEvent, string>;
  studySessions!: Table<StudySession, string>;
  studyIntervals!: Table<StudyInterval, string>;
  sessionRevisions!: Table<SessionRevision, string>;
  executionSettings!: Table<ExecutionSettings, string>;
  growthRecords!: Table<GrowthRecord, string>;
  meditationSessions!: Table<MeditationSession, string>;
  meditationIntervals!: Table<MeditationInterval, string>;
  planningPeriods!: Table<PlanningPeriod, string>;
  dailyReviews!: Table<DailyReview, string>;
  weeklyWorkloadPlans!: Table<WeeklyWorkloadPlan, string>;
  syncOutbox!: Table<SyncChange, string>;

  constructor(name = "StudyFlow") {
    super(name);
    this.version(1).stores({
      tasks: "id, categoryId, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
    });
    this.version(2).stores({
      tasks: "id, categoryId, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt",
      executionSettings: "id",
    }).upgrade(async (tx) => {
      const table = tx.table<ExecutionSettings, string>("executionSettings");
      await table.put(defaultExecutionSettings());
    });
    this.version(3).stores({
      tasks: "id, categoryId, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt",
      executionSettings: "id",
      growthRecords: "id, &sourceSessionId, sourceType, plantType, localDate, createdAt",
      meditationSessions: "id, status, mode, startedAt, endedAt, updatedAt",
      meditationIntervals: "id, sessionId, kind, startedAt, endedAt",
    });
    this.version(4).stores({
      tasks: "id, categoryId, planId, isCoreTask, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt", executionSettings: "id",
      growthRecords: "id, &sourceSessionId, sourceType, plantType, localDate, createdAt",
      meditationSessions: "id, status, mode, startedAt, endedAt, updatedAt",
      meditationIntervals: "id, sessionId, kind, startedAt, endedAt",
      planningPeriods: "id, type, parentId, startDate, endDate, createdAt",
    }).upgrade(async (tx) => {
      await tx.table<Task, string>("tasks").toCollection().modify({ planId: null, isCoreTask: false, avoidanceCount: 0, minimumStartMinutes: null });
      await tx.table<StudySession, string>("studySessions").toCollection().modify({ isCoreTaskSnapshot: false, minimumStartTargetSeconds: null });
    });
    this.version(5).stores({
      tasks: "id, categoryId, planId, isCoreTask, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt", executionSettings: "id",
      growthRecords: "id, &sourceSessionId, sourceType, plantType, localDate, createdAt",
      meditationSessions: "id, status, mode, startedAt, endedAt, updatedAt",
      meditationIntervals: "id, sessionId, kind, startedAt, endedAt",
      planningPeriods: "id, type, parentId, startDate, endDate, createdAt",
      dailyReviews: "id, &localDate, updatedAt",
    });
    this.version(6).stores({
      tasks: "id, categoryId, planId, isCoreTask, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt", executionSettings: "id",
      growthRecords: "id, &sourceSessionId, sourceType, plantType, localDate, createdAt",
      meditationSessions: "id, status, mode, startedAt, endedAt, updatedAt",
      meditationIntervals: "id, sessionId, kind, startedAt, endedAt",
      planningPeriods: "id, type, parentId, startDate, endDate, createdAt",
      dailyReviews: "id, &localDate, updatedAt",
      syncOutbox: "id, syncedAt, entityType, [entityType+entityId], updatedAt",
    }).upgrade(async (tx) => {
      await tx.table<ExecutionSettings, string>("executionSettings").toCollection().modify((value) => {
        value.ambientSound ??= "off";
        value.ambientVolume ??= 50;
        value.completionSound ??= "wind-chime";
      });
    });
    this.version(7).stores({
      tasks: "id, categoryId, planId, isCoreTask, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt", executionSettings: "id",
      growthRecords: "id, &sourceSessionId, sourceType, plantType, localDate, createdAt",
      meditationSessions: "id, status, mode, startedAt, endedAt, updatedAt",
      meditationIntervals: "id, sessionId, kind, startedAt, endedAt",
      planningPeriods: "id, type, parentId, startDate, endDate, createdAt",
      dailyReviews: "id, &localDate, updatedAt", syncOutbox: "id, syncedAt, entityType, [entityType+entityId], updatedAt",
    }).upgrade(async (tx) => {
      await tx.table<ExecutionSettings, string>("executionSettings").toCollection().modify((value) => {
        value.workloadTargets ??= [];
      });
    });
    this.version(8).stores({
      tasks: "id, categoryId, planId, isCoreTask, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
      studySessions: "id, taskId, categoryId, status, mode, startedAt, endedAt, updatedAt",
      studyIntervals: "id, sessionId, kind, startedAt, endedAt",
      sessionRevisions: "id, sessionId, createdAt", executionSettings: "id",
      growthRecords: "id, &sourceSessionId, sourceType, plantType, localDate, createdAt",
      meditationSessions: "id, status, mode, startedAt, endedAt, updatedAt",
      meditationIntervals: "id, sessionId, kind, startedAt, endedAt",
      planningPeriods: "id, type, parentId, startDate, endDate, createdAt",
      dailyReviews: "id, &localDate, updatedAt", weeklyWorkloadPlans: "id, &weekStart, updatedAt",
      syncOutbox: "id, syncedAt, entityType, [entityType+entityId], updatedAt",
    });

    this.on("populate", () => {
      const timestamp = nowIso();
      return Promise.all([
        this.categories.bulkAdd(DEFAULT_CATEGORY_NAMES.map((name, sortOrder) => ({
          id: createId(),
          name,
          sortOrder,
          archivedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }))),
        this.executionSettings.put(defaultExecutionSettings(timestamp)),
      ]);
    });
  }
}

export function defaultExecutionSettings(at = nowIso()): ExecutionSettings {
  return {
    id: "default", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15,
    roundsPerSet: 4, soundEnabled: true, soundVolume: 80, ambientSound: "off", ambientVolume: 50,
    completionSound: "wind-chime", notificationsEnabled: false,
    stopwatchAutoPauseMinutes: 240, workloadTargets: [], updatedAt: at,
  };
}

export const db = new StudyFlowDatabase();
