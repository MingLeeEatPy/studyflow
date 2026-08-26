import { syncChangeSchema, type SyncChange, type SyncEntityType, type SyncOperation } from "../../shared/schemas/models";
import { db } from "../db/database";

export type SyncRecord = {
  id: string;
  updatedAt: string;
};

export function compareByUpdatedAt(local: SyncRecord, remote: SyncRecord): "local" | "remote" | "equal" {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);
  if (localTime > remoteTime) return "local";
  if (remoteTime > localTime) return "remote";
  return local.id === remote.id ? "equal" : (local.id > remote.id ? "local" : "remote");
}

export async function enqueueSyncChange(input: {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  updatedAt: string;
  createdAt?: string;
}): Promise<SyncChange> {
  const change = syncChangeSchema.parse({
    id: crypto.randomUUID(),
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
    syncedAt: null,
    attemptCount: 0,
    lastError: null,
  });
  let storedChange = change;
  await db.transaction("rw", db.syncOutbox, async () => {
    const existingChanges = await db.syncOutbox
      .where("[entityType+entityId]")
      .equals([change.entityType, change.entityId])
      .toArray();
    const duplicate = existingChanges.find((item) => item.operation === change.operation && item.updatedAt === change.updatedAt
      && JSON.stringify(item.payload) === JSON.stringify(change.payload));
    if (duplicate) { storedChange = duplicate; return; }
    const previous = existingChanges.filter((item) => item.syncedAt === null);
    if (previous.length > 0) await db.syncOutbox.bulkDelete(previous.map((item) => item.id));
    await db.syncOutbox.add(change);
  });
  return storedChange;
}

export async function pendingSyncChanges(): Promise<SyncChange[]> {
  const changes = await db.syncOutbox.toArray();
  return changes.filter((change) => change.syncedAt === null).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function markSyncChangesSynced(ids: string[], syncedAt = new Date().toISOString()): Promise<void> {
  if (ids.length === 0) return;
  await db.syncOutbox.where("id").anyOf(ids).modify({ syncedAt, lastError: null });
}

export async function markSyncChangeFailed(id: string, error: string): Promise<void> {
  const change = await db.syncOutbox.get(id);
  if (!change) return;
  await db.syncOutbox.put({ ...change, attemptCount: change.attemptCount + 1, lastError: error });
}
