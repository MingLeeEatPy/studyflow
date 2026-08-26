import type { SyncChange } from "../../shared/schemas/models";
import { authAdapter } from "./authAdapter";
import { getSupabaseConfig, supabaseHeaders } from "./supabaseClient";

export type RemoteSyncEntity = {
  entity_type: SyncChange["entityType"];
  entity_id: string;
  payload: unknown;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
};

function requireConfig() {
  const config = getSupabaseConfig();
  const token = authAdapter.getAccessToken();
  const userId = authAdapter.getUserId();
  if (!config || !token || !userId) throw new Error("尚未登录 Supabase");
  return { config, token, userId };
}

export async function pushSyncChanges(changes: SyncChange[]): Promise<void> {
  if (changes.length === 0) return;
  const { config, token, userId } = requireConfig();
  const response = await fetch(`${config.url}/rest/v1/sync_entities?on_conflict=entity_type,entity_id`, {
    method: "POST",
    headers: { ...supabaseHeaders(config, token), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(changes.map((change) => ({
      user_id: userId, entity_type: change.entityType, entity_id: change.entityId, payload: change.payload,
      updated_at: change.updatedAt, created_at: change.createdAt,
      deleted_at: change.operation === "delete" ? change.updatedAt : null,
    }))),
  });
  if (!response.ok) throw new Error(`同步上传失败（${response.status}）`);
}

export async function pullSyncChanges(cursor: string): Promise<{ changes: RemoteSyncEntity[]; cursor: string }> {
  const { config, token, userId } = requireConfig();
  const query = new URLSearchParams({ select: "entity_type,entity_id,payload,updated_at,created_at,deleted_at", user_id: `eq.${userId}`, order: "updated_at.asc", updated_at: `gt.${cursor}` });
  const response = await fetch(`${config.url}/rest/v1/sync_entities?${query.toString()}`, { headers: supabaseHeaders(config, token) });
  if (!response.ok) throw new Error(`同步下载失败（${response.status}）`);
  const changes = await response.json() as RemoteSyncEntity[];
  return { changes, cursor: changes.at(-1)?.updated_at ?? cursor };
}
