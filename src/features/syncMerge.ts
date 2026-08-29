import type { SyncEntityType } from "../../shared/schemas/models";
import {
  categorySchema,
  dailyReviewSchema,
  executionSettingsSchema,
  growthRecordSchema,
  meditationIntervalSchema,
  meditationSessionSchema,
  planningPeriodSchema,
  sessionRevisionSchema,
  studyIntervalSchema,
  studySessionSchema,
  taskSchema,
} from "../../shared/schemas/models";
import { compareByUpdatedAt, enqueueSyncChange } from "../domain/sync";
import { db } from "../db/database";
import type { RemoteSyncEntity } from "./syncTransport";

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

type TimestampedPayload = { id: string; createdAt?: string; updatedAt?: string };

function olderFirst(left: TimestampedPayload, right: TimestampedPayload): number {
  const leftStamp = left.createdAt ?? left.updatedAt ?? "";
  const rightStamp = right.createdAt ?? right.updatedAt ?? "";
  return leftStamp.localeCompare(rightStamp) || left.id.localeCompare(right.id);
}

/** Collapse cloud rows that share a Dexie unique key before writing them. */
export function normalizeRemoteEntities(changes: RemoteSyncEntity[]): RemoteSyncEntity[] {
  const categoryAliases = new Map<string, string>();
  const categories = new Map<string, { remote: RemoteSyncEntity; payload: typeof categorySchema._output }>();
  const growth = new Map<string, { remote: RemoteSyncEntity; payload: typeof growthRecordSchema._output }>();
  const reviews = new Map<string, { remote: RemoteSyncEntity; payload: typeof dailyReviewSchema._output }>();

  for (const remote of changes) {
    if (remote.deleted_at) continue;
    if (remote.entity_type === "category") {
      const parsed = categorySchema.safeParse(remote.payload);
      if (!parsed.success) continue;
      const current = categories.get(parsed.data.name);
      if (!current || olderFirst(parsed.data, current.payload) < 0) categories.set(parsed.data.name, { remote, payload: parsed.data });
    } else if (remote.entity_type === "growthRecord") {
      const parsed = growthRecordSchema.safeParse(remote.payload);
      if (!parsed.success) continue;
      const current = growth.get(parsed.data.sourceSessionId);
      if (!current || olderFirst(parsed.data, current.payload) < 0) growth.set(parsed.data.sourceSessionId, { remote, payload: parsed.data });
    } else if (remote.entity_type === "dailyReview") {
      const parsed = dailyReviewSchema.safeParse(remote.payload);
      if (!parsed.success) continue;
      const current = reviews.get(parsed.data.localDate);
      if (!current || compareByUpdatedAt(current.payload, parsed.data) === "remote") reviews.set(parsed.data.localDate, { remote, payload: parsed.data });
    }
  }

  for (const remote of changes) {
    if (remote.deleted_at || remote.entity_type !== "category") continue;
    const parsed = categorySchema.safeParse(remote.payload);
    if (parsed.success) categoryAliases.set(parsed.data.id, categories.get(parsed.data.name)!.payload.id);
  }

  return changes.flatMap((remote) => {
    if (remote.deleted_at) return [remote];
    if (remote.entity_type === "category") {
      const parsed = categorySchema.safeParse(remote.payload);
      return parsed.success && categories.get(parsed.data.name)?.payload.id !== parsed.data.id ? [] : [remote];
    }
    if (remote.entity_type === "growthRecord") {
      const parsed = growthRecordSchema.safeParse(remote.payload);
      return parsed.success && growth.get(parsed.data.sourceSessionId)?.payload.id !== parsed.data.id ? [] : [remote];
    }
    if (remote.entity_type === "dailyReview") {
      const parsed = dailyReviewSchema.safeParse(remote.payload);
      return parsed.success && reviews.get(parsed.data.localDate)?.payload.id !== parsed.data.id ? [] : [remote];
    }
    if (remote.entity_type === "task") {
      const parsed = taskSchema.safeParse(remote.payload);
      if (!parsed.success) return [remote];
      return [{ ...remote, payload: { ...parsed.data, categoryId: categoryAliases.get(parsed.data.categoryId) ?? parsed.data.categoryId } }];
    }
    if (remote.entity_type === "studySession") {
      const parsed = studySessionSchema.safeParse(remote.payload);
      if (!parsed.success) return [remote];
      return [{ ...remote, payload: { ...parsed.data, categoryId: categoryAliases.get(parsed.data.categoryId) ?? parsed.data.categoryId } }];
    }
    return [remote];
  });
}

async function replaceCategoryWithRemote(next: typeof categorySchema._output): Promise<void> {
  const duplicate = await db.categories.where("name").equals(next.name).first();
  if (!duplicate || duplicate.id === next.id) {
    await db.categories.put(next);
    return;
  }

  const changedAt = new Date().toISOString();
  await db.transaction("rw", db.categories, db.tasks, db.studySessions, db.taskEvents, async () => {
    await db.tasks.where("categoryId").equals(duplicate.id).modify((task) => {
      task.categoryId = next.id;
      task.updatedAt = changedAt;
    });
    await db.studySessions.where("categoryId").equals(duplicate.id).modify((session) => {
      session.categoryId = next.id;
      session.updatedAt = changedAt;
    });
    await db.taskEvents.toCollection().modify((event) => {
      if (event.snapshot.categoryId === duplicate.id) event.snapshot.categoryId = next.id;
    });
    await db.categories.delete(duplicate.id);
    await db.categories.put(next);
  });

  await enqueueSyncChange({ entityType: "category", entityId: duplicate.id, operation: "delete", payload: duplicate, updatedAt: changedAt });
}

export async function applyRemoteEntity(remote: RemoteSyncEntity): Promise<boolean> {
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

  if (entityType === "category") {
    await replaceCategoryWithRemote(next as typeof categorySchema._output);
    return true;
  }
  if (entityType === "growthRecord") {
    const record = next as typeof growthRecordSchema._output;
    const duplicate = await db.growthRecords.where("sourceSessionId").equals(record.sourceSessionId).first();
    if (duplicate && duplicate.id !== record.id) await db.growthRecords.delete(duplicate.id);
  }
  if (entityType === "dailyReview") {
    const review = next as typeof dailyReviewSchema._output;
    const duplicate = await db.dailyReviews.where("localDate").equals(review.localDate).first();
    if (duplicate && duplicate.id !== review.id) {
      if (compareByUpdatedAt(duplicate, review) === "local") return false;
      await db.dailyReviews.delete(duplicate.id);
    }
  }

  if (existing && appendOnly.has(entityType)) return false;
  if (existing?.updatedAt && next.updatedAt && compareByUpdatedAt(
    { id: existing.id, updatedAt: existing.updatedAt },
    { id: next.id, updatedAt: next.updatedAt },
  ) === "local") return false;
  await table.put(next);
  return true;
}
