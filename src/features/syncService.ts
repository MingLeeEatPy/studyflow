import type { SyncEntityType } from "../../shared/schemas/models";
import { enqueueSyncChange, markSyncChangesSynced, pendingSyncChanges } from "../domain/sync";
import { db, DEFAULT_CATEGORY_NAMES } from "../db/database";
import { backupRepository } from "../db/backupRepository";
import { authAdapter } from "./authAdapter";
import { pullSyncChanges, pushSyncChanges, type RemoteSyncEntity } from "./syncTransport";
import { applyRemoteEntity, normalizeRemoteEntities } from "./syncMerge";

const STORAGE_PREFIX = "studyflow.supabase.sync";
const LEGACY_CURSOR_KEY = "studyflow.supabase.sync-cursor";
const LEGACY_SNAPSHOT_KEY = "studyflow.supabase.sync-snapshot";

export type SyncStatus = "not-configured" | "signed-out" | "synced" | "offline" | "error";
export type SyncResult = { status: SyncStatus; uploaded: number; downloaded: number; error?: string };
export type MergeSummary = { localCount: number; remoteCount: number; remoteEntities: RemoteSyncEntity[] };
export type InitialSyncDecision = "download-cloud" | "upload-local" | "ask-merge" | "incremental";
export type SyncInitialization = { result: SyncResult; mergeSummary: MergeSummary | null };

export function syncErrorStatus(error: unknown): "signed-out" | "offline" | "error" {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("401") || message.includes("pgrst301") || message.includes("jwt")
    || message.includes("登录已过期") || message.includes("unauthorized")) return "signed-out";
  if (error instanceof TypeError || message.includes("failed to fetch") || message.includes("network request failed")
    || message.includes("load failed") || message.includes("networkerror")) return "offline";
  if (navigator.onLine === false && !message.includes("同步下载失败（") && !message.includes("同步上传失败（")) return "offline";
  return "error";
}

export function scopedSyncStorageKey(kind: "cursor" | "snapshot" | "initialized", userId: string): string {
  return `${STORAGE_PREFIX}.${kind}.${userId}`;
}

export function decideInitialSync(initialized: boolean, localHasData: boolean, remoteHasData: boolean): InitialSyncDecision {
  if (initialized) return "incremental";
  if (!localHasData && remoteHasData) return "download-cloud";
  if (localHasData && !remoteHasData) return "upload-local";
  if (localHasData && remoteHasData) return "ask-merge";
  return "incremental";
}

export function hasMeaningfulLocalData(data: Record<string, unknown>): boolean {
  const meaningfulCollections = [
    "tasks", "planningPeriods", "studySessions", "studyIntervals", "sessionRevisions",
    "growthRecords", "meditationSessions", "meditationIntervals", "dailyReviews",
  ];
  if (meaningfulCollections.some((key) => Array.isArray(data[key]) && data[key].length > 0)) return true;
  const defaultNames = new Set<string>(DEFAULT_CATEGORY_NAMES);
  const categories = Array.isArray(data.categories) ? data.categories : [];
  return categories.some((value) => {
    if (!value || typeof value !== "object" || !("name" in value)) return true;
    return typeof value.name !== "string" || !defaultNames.has(value.name);
  });
}

function userIdOrNull(): string | null {
  return authAdapter.getUserId();
}

function storageKey(kind: "cursor" | "snapshot" | "initialized"): string {
  const userId = userIdOrNull();
  if (!userId) throw new Error("尚未登录 Supabase");
  return scopedSyncStorageKey(kind, userId);
}

function migrateLegacySyncState(): boolean {
  const initializedKey = storageKey("initialized");
  if (localStorage.getItem(initializedKey) === "1") return true;
  const legacyCursor = localStorage.getItem(LEGACY_CURSOR_KEY);
  const legacySnapshot = localStorage.getItem(LEGACY_SNAPSHOT_KEY);
  if (!legacyCursor && !legacySnapshot) return false;
  if (legacyCursor) localStorage.setItem(storageKey("cursor"), legacyCursor);
  if (legacySnapshot) localStorage.setItem(storageKey("snapshot"), legacySnapshot);
  localStorage.setItem(initializedKey, "1");
  return true;
}

export function isCloudSyncInitialized(): boolean {
  return Boolean(userIdOrNull()) && migrateLegacySyncState();
}

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

function entryKey(entityType: SyncEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

async function writeCurrentSnapshot(): Promise<void> {
  const snapshot = Object.fromEntries((await collectCurrentEntries()).map(({ entityType, entity }) => [entryKey(entityType, entity.id), entity.updatedAt]));
  localStorage.setItem(storageKey("snapshot"), JSON.stringify(snapshot));
}

async function clearPendingOutbox(): Promise<void> {
  const pending = await pendingSyncChanges();
  if (pending.length > 0) await db.syncOutbox.bulkDelete(pending.map((change) => change.id));
}

async function queueCurrentEntries(selectedKeys: Set<string>): Promise<void> {
  for (const { entityType, entity } of await collectCurrentEntries()) {
    if (!selectedKeys.has(entryKey(entityType, entity.id))) continue;
    await enqueueSyncChange({ entityType, entityId: entity.id, operation: "upsert", payload: entity, updatedAt: entity.updatedAt });
  }
}

function hasMeaningfulRemoteData(changes: RemoteSyncEntity[]): boolean {
  const defaultNames = new Set<string>(DEFAULT_CATEGORY_NAMES);
  return changes.some((remote) => {
    if (remote.deleted_at) return false;
    if (remote.entity_type === "executionSettings") return false;
    if (remote.entity_type !== "category") return true;
    const payload = remote.payload;
    return !payload || typeof payload !== "object" || !("name" in payload)
      || typeof payload.name !== "string" || !defaultNames.has(payload.name);
  });
}

async function applyRemoteSnapshot(changes: RemoteSyncEntity[]): Promise<number> {
  let downloaded = 0;
  for (const entity of normalizeRemoteEntities(changes)) if (await applyRemoteEntity(entity)) downloaded += 1;
  return downloaded;
}

async function queueChangedBackup(): Promise<number> {
  let snapshot: Record<string, string> = {};
  try { snapshot = JSON.parse(localStorage.getItem(storageKey("snapshot")) ?? "{}"); } catch { snapshot = {}; }
  const entries = await collectCurrentEntries();
  const nextSnapshot: Record<string, string> = {};
  for (const { entityType, entity } of entries) {
    const key = entryKey(entityType, entity.id);
    nextSnapshot[key] = entity.updatedAt;
    if (snapshot[key] === entity.updatedAt) continue;
    await enqueueSyncChange({ entityType, entityId: entity.id, operation: "upsert", payload: entity, updatedAt: entity.updatedAt });
  }
  localStorage.setItem(storageKey("snapshot"), JSON.stringify(nextSnapshot));
  return entries.length - Object.keys(snapshot).filter((key) => nextSnapshot[key] === snapshot[key]).length;
}

/** Force a complete local scan when an older build left local records outside the outbox. */
export async function forceUploadLocal(): Promise<SyncResult> {
  if (!authAdapter.isConfigured() || !authAdapter.getAccessToken()) return { status: "signed-out", uploaded: 0, downloaded: 0 };
  try {
    localStorage.removeItem(storageKey("snapshot"));
    await queueChangedBackup();
    return syncNow();
  } catch (error) {
    return { status: syncErrorStatus(error), uploaded: 0, downloaded: 0, error: error instanceof Error ? error.message : "重新上传本地数据失败" };
  }
}


export async function confirmFirstMerge(strategy: "keep-local" | "merge"): Promise<SyncResult> {
  if (!authAdapter.isConfigured() || !authAdapter.getAccessToken()) return { status: "signed-out", uploaded: 0, downloaded: 0 };
  try {
    if (strategy === "merge") {
      const localEntries = await collectCurrentEntries();
      const localKeys = new Set(localEntries.map(({ entityType, entity }) => entryKey(entityType, entity.id)));
      await clearPendingOutbox();
      const remote = await pullSyncChanges("1970-01-01T00:00:00.000Z");
      const downloaded = await applyRemoteSnapshot(remote.changes);
      await queueCurrentEntries(localKeys);
      await writeCurrentSnapshot();
      const localPending = await pendingSyncChanges();
      await pushSyncChanges(localPending);
      await markSyncChangesSynced(localPending.map((change) => change.id));
      writeCursor(remote.cursor);
      localStorage.setItem(storageKey("initialized"), "1");
      return { status: "synced", uploaded: localPending.length, downloaded };
    }
    await queueChangedBackup();
    const result = await syncNow();
    if (result.status === "synced") localStorage.setItem(storageKey("initialized"), "1");
    return result;
  } catch (error) {
    return { status: syncErrorStatus(error), uploaded: 0, downloaded: 0, error: error instanceof Error ? error.message : "首次合并失败，请检查网络和 Supabase 配置" };
  }
}

function readCursor(): string {
  return localStorage.getItem(storageKey("cursor")) ?? "1970-01-01T00:00:00.000Z";
}

function writeCursor(cursor: string): void {
  localStorage.setItem(storageKey("cursor"), cursor);
}

let initializationInFlight: Promise<SyncInitialization> | null = null;

async function initializeCloudSyncInternal(): Promise<SyncInitialization> {
  if (!authAdapter.isConfigured()) return { result: { status: "not-configured", uploaded: 0, downloaded: 0 }, mergeSummary: null };
  if (!authAdapter.getAccessToken() || !userIdOrNull()) return { result: { status: "signed-out", uploaded: 0, downloaded: 0 }, mergeSummary: null };

  try {
    const backup = await backupRepository.exportData();
    const remote = await pullSyncChanges("1970-01-01T00:00:00.000Z");
    const normalized = normalizeRemoteEntities(remote.changes);
    const localHasData = hasMeaningfulLocalData(backup.data as unknown as Record<string, unknown>);
    const remoteHasData = hasMeaningfulRemoteData(normalized);
    const initialized = migrateLegacySyncState();
    const decision = decideInitialSync(initialized, localHasData, remoteHasData);

    // If browser storage kept the account marker but IndexedDB was evicted,
    // treat the device as empty and restore the complete cloud snapshot.
    if (decision === "download-cloud" || (initialized && !localHasData && remoteHasData)) {
      await clearPendingOutbox();
      const downloaded = await applyRemoteSnapshot(normalized);
      await writeCurrentSnapshot();
      writeCursor(remote.cursor);
      const cleanup = await pendingSyncChanges();
      await pushSyncChanges(cleanup);
      await markSyncChangesSynced(cleanup.map((change) => change.id));
      localStorage.setItem(storageKey("initialized"), "1");
      return { result: { status: "synced", uploaded: cleanup.length, downloaded }, mergeSummary: null };
    }

    if (decision === "upload-local") {
      const result = await forceUploadLocal();
      if (result.status === "synced") localStorage.setItem(storageKey("initialized"), "1");
      return { result, mergeSummary: null };
    }

    if (decision === "ask-merge") {
      return {
        result: { status: "synced", uploaded: 0, downloaded: 0 },
        mergeSummary: {
          localCount: backupEntityEntries(backup).length,
          remoteCount: normalized.filter((item) => !item.deleted_at).length,
          remoteEntities: normalized,
        },
      };
    }

    const result = await syncNow();
    if (result.status === "synced") localStorage.setItem(storageKey("initialized"), "1");
    return { result, mergeSummary: null };
  } catch (error) {
    return {
      result: {
        status: syncErrorStatus(error),
        uploaded: 0,
        downloaded: 0,
        error: error instanceof Error ? error.message : "自动云同步初始化失败",
      },
      mergeSummary: null,
    };
  }
}

export function initializeCloudSync(): Promise<SyncInitialization> {
  if (initializationInFlight) return initializationInFlight;
  initializationInFlight = initializeCloudSyncInternal().finally(() => { initializationInFlight = null; });
  return initializationInFlight;
}

let syncInFlight: Promise<SyncResult> | null = null;

async function performSync(): Promise<SyncResult> {
  if (!authAdapter.isConfigured()) return { status: "not-configured", uploaded: 0, downloaded: 0 };
  if (!authAdapter.getAccessToken()) return { status: "signed-out", uploaded: 0, downloaded: 0 };
  try {
    await queueChangedBackup();
    const pending = await pendingSyncChanges();
    await pushSyncChanges(pending);
    await markSyncChangesSynced(pending.map((change) => change.id));
    const pulled = await pullSyncChanges(readCursor());
    let downloaded = 0;
    for (const remote of normalizeRemoteEntities(pulled.changes)) if (await applyRemoteEntity(remote)) downloaded += 1;
    // Downloaded rows are already synchronized. Refresh the local snapshot so
    // the next timer tick does not upload the same cloud history back again.
    await writeCurrentSnapshot();
    writeCursor(pulled.cursor);
    return { status: "synced", uploaded: pending.length, downloaded };
  } catch (error) {
    return { status: syncErrorStatus(error), uploaded: 0, downloaded: 0, error: error instanceof Error ? error.message : "同步失败" };
  }
}

export function syncNow(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = performSync().finally(() => { syncInFlight = null; });
  return syncInFlight;
}
