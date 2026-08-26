import type { SyncEntityType } from "../../shared/schemas/models";
import {
  categorySchema, dailyReviewSchema, executionSettingsSchema, growthRecordSchema,
  meditationIntervalSchema, meditationSessionSchema, planningPeriodSchema,
  sessionRevisionSchema, studyIntervalSchema, studySessionSchema, taskSchema,
} from "../../shared/schemas/models";
import { compareByUpdatedAt, enqueueSyncChange, markSyncChangesSynced, pendingSyncChanges } from "../domain/sync";
import { db } from "../db/database";
import { backupRepository } from "../db/backupRepository";
import { authAdapter } from "./authAdapter";
import { pullSyncChanges, pushSyncChanges, type RemoteSyncEntity } from "./syncTransport";

const CURSOR_KEY = "studyflow.supabase.sync-cursor";
const tableByEntity: Record<SyncEntityType, string> = {
  category: "categories", task: "tasks", planningPeriod: "planningPeriods", studySession: "studySessions",
  studyInterval: "studyIntervals", sessionRevision: "sessionRevisions", growthRecord: "growthRecords",
  meditationSession: "meditationSessions", meditationInterval: "meditationIntervals", dailyReview: "dailyReviews",
  executionSettings: "executionSettings",
};
const appendOnly = new Set<SyncEntityType>([
  "studySession", "studyInterval", "sessionRevision", "growthRecord", "meditationSession", "meditationInterval",
]);
const schemaByEntity: Record<SyncEntityType, { safeParse(value: unknown): { success: boolean; data?: unknown } }> = {
  category: categorySchema, task: taskSchema, planningPeriod: planningPeriodSchema, studySession: studySessionSchema,
  studyInterval: studyIntervalSchema, sessionRevision: sessionRevisionSchema, growthRecord: growthRecordSchema,
  meditationSession: meditationSessionSchema, meditationInterval: meditationIntervalSchema, dailyReview: dailyReviewSchema,
  executionSettings: executionSettingsSchema,
};

export type SyncStatus = "not-configured" | "signed-out" | "synced" | "offline" | "error";
export type SyncResult = { status: SyncStatus; uploaded: number; downloaded: number; error?: string };
export type MergeSummary = { localCount: number; remoteCount: number; remoteEntities: RemoteSyncEntity[] };

export async function createLocalBackup(): Promise<Blob> {
  const backup = await backupRepository.exportData();
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
}

function backupEntityEntries(backup: Awaited<ReturnType<typeof backupRepository.exportData>>): Array<{ entityType: SyncEntityType; entity: { id: string; updatedAt: string } }> {
  const stamp = <T extends { id: string; createdAt?: string; updatedAt?: string }>(entity: T) => ({ ...entity, updatedAt: entity.updatedAt ?? entity.createdAt ?? new Date().toISOString() });
  return [
    ...backup.data.categories.map((entity) => ({ entityType: "category" as const, entity: stamp(entity) })),
    ...backup.data.tasks.map((entity) => ({ entityType: "task" as const, entity: stamp(entity) })),
    ...backup.data.planningPeriods.map((entity) => ({ entityType: "planningPeriod" as const, entity: stamp(entity) })),
    ...backup.data.studySessions.map((entity) => ({ entityType: "studySession" as const, entity: stamp(entity) })),
    ...backup.data.studyIntervals.map((entity) => ({ entityType: "studyInterval" as const, entity: stamp(entity) })),
    ...backup.data.sessionRevisions.map((entity) => ({ entityType: "sessionRevision" as const, entity: stamp(entity) })),
    ...backup.data.growthRecords.map((entity) => ({ entityType: "growthRecord" as const, entity: stamp(entity) })),
    ...backup.data.meditationSessions.map((entity) => ({ entityType: "meditationSession" as const, entity: stamp(entity) })),
    ...backup.data.meditationIntervals.map((entity) => ({ entityType: "meditationInterval" as const, entity: stamp(entity) })),
    ...backup.data.dailyReviews.map((entity) => ({ entityType: "dailyReview" as const, entity: stamp(entity) })),
    { entityType: "executionSettings" as const, entity: stamp(backup.data.executionSettings) },
  ];
}

async function collectCurrentEntries(): Promise<Array<{ entityType: SyncEntityType; entity: { id: string; updatedAt: string } }>> {
  const [categories, tasks, planningPeriods, studySessions, studyIntervals, sessionRevisions, growthRecords, meditationSessions, meditationIntervals, dailyReviews, executionSettings] = await Promise.all([
    db.categories.toArray(), db.tasks.toArray(), db.planningPeriods.toArray(), db.studySessions.toArray(), db.studyIntervals.toArray(),
    db.sessionRevisions.toArray(), db.growthRecords.toArray(), db.meditationSessions.toArray(), db.meditationIntervals.toArray(), db.dailyReviews.toArray(), db.executionSettings.get("default"),
  ]);
  return backupEntityEntries({ data: { categories, tasks, planningPeriods, studySessions, studyIntervals, sessionRevisions, growthRecords, meditationSessions, meditationIntervals, dailyReviews, executionSettings: executionSettings! } } as Awaited<ReturnType<typeof backupRepository.exportData>>);
}

async function queueFullBackup(): Promise<number> {
  const entries = await collectCurrentEntries();
  for (const { entityType, entity } of entries) {
    await enqueueSyncChange({ entityType, entityId: entity.id, operation: "upsert", payload: entity, updatedAt: entity.updatedAt });
  }
  return entries.length;
}

export async function prepareFirstMerge(): Promise<{ backup: Blob; summary: MergeSummary }> {
  const backup = await backupRepository.exportData();
  const remote = await pullSyncChanges("1970-01-01T00:00:00.000Z");
  return { backup: new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), summary: { localCount: backupEntityEntries(backup).length, remoteCount: remote.changes.length, remoteEntities: remote.changes } };
}

export async function confirmFirstMerge(strategy: "keep-local" | "merge"): Promise<SyncResult> {
  if (!authAdapter.isConfigured() || !authAdapter.getAccessToken()) return { status: "signed-out", uploaded: 0, downloaded: 0 };
  if (strategy === "merge") {
    const remote = await pullSyncChanges("1970-01-01T00:00:00.000Z");
    for (const entity of remote.changes) await applyRemoteEntity(entity);
  }
  await queueFullBackup();
  return syncNow();
}

function readCursor(): string {
  return localStorage.getItem(CURSOR_KEY) ?? "1970-01-01T00:00:00.000Z";
}

function writeCursor(cursor: string): void {
  localStorage.setItem(CURSOR_KEY, cursor);
}

async function applyRemoteEntity(remote: RemoteSyncEntity): Promise<boolean> {
  const entityType = remote.entity_type;
  const table = db.table(tableByEntity[entityType]);
  const existing = await table.get(remote.entity_id) as { id: string; updatedAt?: string } | undefined;
  if (remote.deleted_at) {
    if (existing) await table.delete(remote.entity_id);
    return Boolean(existing);
  }
  const parsed = schemaByEntity[entityType].safeParse(remote.payload);
  if (!parsed.success || !parsed.data) throw new Error(`远端 ${entityType} 数据格式无效`);
  const next = parsed.data as { id: string; updatedAt?: string };
  if (existing && appendOnly.has(entityType)) return false;
  if (existing?.updatedAt && next.updatedAt && compareByUpdatedAt({ id: existing.id, updatedAt: existing.updatedAt }, { id: next.id, updatedAt: next.updatedAt }) === "local") return false;
  await table.put(next);
  return true;
}

export async function syncNow(): Promise<SyncResult> {
  if (!authAdapter.isConfigured()) return { status: "not-configured", uploaded: 0, downloaded: 0 };
  if (!authAdapter.getAccessToken()) return { status: "signed-out", uploaded: 0, downloaded: 0 };
  await queueFullBackup();
  const pending = await pendingSyncChanges();
  try {
    await pushSyncChanges(pending);
    await markSyncChangesSynced(pending.map((change) => change.id));
    const pulled = await pullSyncChanges(readCursor());
    let downloaded = 0;
    for (const remote of pulled.changes) if (await applyRemoteEntity(remote)) downloaded += 1;
    writeCursor(pulled.cursor);
    return { status: "synced", uploaded: pending.length, downloaded };
  } catch (error) {
    return { status: navigator.onLine === false ? "offline" : "error", uploaded: 0, downloaded: 0, error: error instanceof Error ? error.message : "同步失败" };
  }
}
