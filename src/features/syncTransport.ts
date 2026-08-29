import type { SyncChange } from "../../shared/schemas/models";
import { authAdapter } from "./authAdapter";
import { getSupabaseClient } from "./supabaseClient";

export type RemoteSyncEntity = { entity_type: SyncChange["entityType"]; entity_id: string; payload: unknown; updated_at: string; created_at: string; deleted_at: string | null };

function requireClient() {
  const client = getSupabaseClient(); const userId = authAdapter.getUserId();
  if (!client || !userId) throw new Error("尚未登录 Supabase");
  return { client, userId };
}

export async function pushSyncChanges(changes: SyncChange[]): Promise<void> {
  if (changes.length === 0) return;
  const { client, userId } = requireClient();
  for (let index = 0; index < changes.length; index += 100) {
    const batch = changes.slice(index, index + 100).map((change) => ({
      user_id: userId, entity_type: change.entityType, entity_id: change.entityId,
      payload: change.payload, updated_at: change.updatedAt, created_at: change.createdAt,
      deleted_at: change.operation === "delete" ? change.updatedAt : null,
    }));
    // Let PostgREST use the table's declared composite primary key. Supplying
    // an onConflict index string is rejected by some hosted schema versions.
    const { error } = await client.from("sync_entities").upsert(batch);
    if (error) throw new Error(`同步上传失败（${error.code ?? "unknown"}）：${error.message}`);
  }
}

export async function pullSyncChanges(cursor: string): Promise<{ changes: RemoteSyncEntity[]; cursor: string }> {
  const { client, userId } = requireClient();
  const { data, error } = await client.from("sync_entities").select("entity_type,entity_id,payload,updated_at,created_at,deleted_at").eq("user_id", userId).gt("updated_at", cursor).order("updated_at", { ascending: true }).limit(500);
  if (error) throw new Error(`同步下载失败（${error.code ?? "unknown"}）：${error.message}`);
  const changes = (data ?? []) as RemoteSyncEntity[];
  return { changes, cursor: changes.at(-1)?.updated_at ?? cursor };
}
