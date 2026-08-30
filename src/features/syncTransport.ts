import type { SyncChange } from "../../shared/schemas/models";
import { authAdapter } from "./authAdapter";
import { getSupabaseClient } from "./supabaseClient";

export type RemoteSyncEntity = { entity_type: SyncChange["entityType"]; entity_id: string; payload: unknown; updated_at: string; created_at: string; deleted_at: string | null };

type SyncRequestError = { code?: string | null; message: string };
type SyncRequestResult<T> = { data: T | null; error: SyncRequestError | null };
type SyncClientContext = { client: NonNullable<ReturnType<typeof getSupabaseClient>>; userId: string };

export function isAuthenticationError(error: SyncRequestError | null): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  const message = error.message.toLowerCase();
  return code === "401" || code === "PGRST301" || message.includes("jwt")
    || message.includes("unauthorized") || message.includes("not authenticated");
}

async function requireClient(forceRefresh = false): Promise<SyncClientContext> {
  const client = getSupabaseClient();
  const session = forceRefresh ? await authAdapter.refreshSession() : await authAdapter.ensureValidSession();
  const userId = session?.user.id ?? authAdapter.getUserId();
  if (!client || !session || !userId) throw new Error("登录已过期，请重新登录");
  return { client, userId };
}

async function withAuthRetry<T>(operation: (context: SyncClientContext) => PromiseLike<SyncRequestResult<T>>): Promise<SyncRequestResult<T>> {
  let result = await operation(await requireClient());
  if (!isAuthenticationError(result.error)) return result;
  result = await operation(await requireClient(true));
  return result;
}

export async function pushSyncChanges(changes: SyncChange[]): Promise<void> {
  if (changes.length === 0) return;
  const { userId } = await requireClient();
  for (let index = 0; index < changes.length; index += 100) {
    const batch = changes.slice(index, index + 100).map((change) => ({
      user_id: userId, entity_type: change.entityType, entity_id: change.entityId,
      payload: change.payload, updated_at: change.updatedAt, created_at: change.createdAt,
      deleted_at: change.operation === "delete" ? change.updatedAt : null,
    }));
    for (const row of batch) {
      const { data: updatedRows, error: updateError } = await withAuthRetry(({ client }) => client.from("sync_entities").update(row).eq("user_id", userId).eq("entity_type", row.entity_type).eq("entity_id", row.entity_id).select("entity_id"));
      if (updateError) throw new Error(`同步上传失败（${updateError.code ?? "unknown"}）：${updateError.message}`);
      if ((updatedRows?.length ?? 0) > 0) continue;
      const { error: insertError } = await withAuthRetry(({ client }) => client.from("sync_entities").insert(row));
      if (insertError) {
        // A concurrent device may have inserted the row between update and
        // insert. Retry that single row as an update.
        const { error: retryError } = await withAuthRetry(({ client }) => client.from("sync_entities").update(row).eq("user_id", userId).eq("entity_type", row.entity_type).eq("entity_id", row.entity_id));
        if (retryError) throw new Error(`同步上传失败（${retryError.code ?? insertError.code ?? "unknown"}）：${retryError.message}`);
      }
    }
  }
}

export async function pullSyncChanges(cursor: string): Promise<{ changes: RemoteSyncEntity[]; cursor: string }> {
  const { userId } = await requireClient();
  const { data, error } = await withAuthRetry(({ client }) => client.from("sync_entities").select("entity_type,entity_id,payload,updated_at,created_at,deleted_at").eq("user_id", userId).gt("updated_at", cursor).order("updated_at", { ascending: true }).limit(500));
  if (error) throw new Error(`同步下载失败（${error.code ?? "unknown"}）：${error.message}`);
  const changes = (data ?? []) as RemoteSyncEntity[];
  return { changes, cursor: changes.at(-1)?.updated_at ?? cursor };
}
