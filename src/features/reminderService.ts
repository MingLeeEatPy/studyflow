import { authAdapter } from "./authAdapter";
import { cancelDeviceReminders, clearDeviceReminders, putDeviceReminder, reminderRecordId } from "./deviceReminderStore";
import { getSupabaseClient } from "./supabaseClient";
import type { TimerDeadline } from "./timerLifecycle";

export type BackgroundReminderStatus =
  | "unsupported"
  | "signed-out"
  | "permission-required"
  | "subscribed"
  | "denied"
  | "offline"
  | "not-configured"
  | "error";

export interface ReminderService {
  getStatus(): Promise<BackgroundReminderStatus>;
  subscribe(): Promise<BackgroundReminderStatus>;
  unsubscribe(): Promise<void>;
  reconcile(deadline: TimerDeadline | null): Promise<BackgroundReminderStatus>;
  sendTest(): Promise<void>;
}

const DEVICE_KEY = "studyflow:push-device-id";

export function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

async function endpointHash(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function vapidPublicKey(): string | null {
  const key = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY as string | undefined;
  return key?.trim() || null;
}

function supportsPush(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function isAuthError(error: { status?: number; code?: string; message?: string } | null): boolean {
  return error?.status === 401 || error?.code === "PGRST301" || Boolean(error?.message?.toLowerCase().includes("jwt"));
}

async function runWithAuthRetry<T extends { error: { status?: number; code?: string; message?: string } | null }>(operation: () => PromiseLike<T>): Promise<T> {
  let result = await operation();
  if (isAuthError(result.error)) {
    await authAdapter.refreshSession();
    result = await operation();
  }
  return result;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supportsPush()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function cancelRemoteReminders(userId: string, deviceId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !navigator.onLine) return;
  const result = await runWithAuthRetry(() => client.from("timer_reminders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("device_id", deviceId).in("status", ["scheduled", "processing"]));
  if (result.error) throw new Error(result.error.message);
}

export const reminderService: ReminderService = {
  async getStatus() {
    if (!vapidPublicKey()) return "not-configured";
    if (!supportsPush()) return "unsupported";
    if (!await authAdapter.getUser()) return "signed-out";
    if (Notification.permission === "denied") return "denied";
    if (!navigator.onLine) return "offline";
    return await currentSubscription() ? "subscribed" : "permission-required";
  },

  async subscribe() {
    const key = vapidPublicKey();
    if (!key) return "not-configured";
    if (!supportsPush()) return "unsupported";
    const user = await authAdapter.getUser();
    if (!user) return "signed-out";
    if (Notification.permission === "denied") return "denied";
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "permission-required";
    if (!navigator.onLine) return "offline";

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key) });
    const json = subscription.toJSON();
    if (!json.keys?.p256dh || !json.keys.auth) throw new Error("浏览器没有返回完整的推送订阅");
    const client = getSupabaseClient();
    if (!client) return "not-configured";
    const deviceId = getDeviceId();
    const subscriptionEndpointHash = await endpointHash(subscription.endpoint);
    const result = await runWithAuthRetry(() => client.from("push_subscriptions").upsert({
      user_id: user.id,
      device_id: deviceId,
      endpoint: subscription.endpoint,
      endpoint_hash: subscriptionEndpointHash,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,device_id" }));
    if (result.error) throw new Error(result.error.message);
    return "subscribed";
  },

  async unsubscribe() {
    const user = await authAdapter.getUser();
    const deviceId = getDeviceId();
    await cancelDeviceReminders();
    if (user) await cancelRemoteReminders(user.id, deviceId).catch(() => undefined);
    const subscription = await currentSubscription().catch(() => null);
    if (subscription) await subscription.unsubscribe();
    const client = getSupabaseClient();
    if (client && user && navigator.onLine) await runWithAuthRetry(() => client.from("push_subscriptions").update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("device_id", deviceId));
    await clearDeviceReminders();
  },

  async reconcile(deadline) {
    const user = await authAdapter.getUser();
    const deviceId = getDeviceId();
    if (!deadline) {
      await cancelDeviceReminders();
      if (user) await cancelRemoteReminders(user.id, deviceId).catch(() => undefined);
      return this.getStatus();
    }
    const status = await this.getStatus();
    if (status !== "subscribed" || !user) return status;
    const id = reminderRecordId(deadline.intervalId, deadline.revision);
    await cancelDeviceReminders(id);
    await putDeviceReminder({ id, intervalId: deadline.intervalId, revision: deadline.revision, dueAt: deadline.dueAt, state: "scheduled" });
    const client = getSupabaseClient();
    if (!client) return "not-configured";
    await cancelRemoteReminders(user.id, deviceId);
    const result = await runWithAuthRetry(() => client.from("timer_reminders").upsert({
      user_id: user.id,
      device_id: deviceId,
      session_id: deadline.sessionId,
      interval_id: deadline.intervalId,
      revision: deadline.revision,
      kind: deadline.kind,
      due_at: deadline.dueAt,
      status: "scheduled",
      attempt_count: 0,
      last_error: null,
      lease_until: null,
      delivered_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,device_id,interval_id,revision" }));
    if (result.error) throw new Error(result.error.message);
    return "subscribed";
  },

  async sendTest() {
    const status = await this.getStatus();
    if (status !== "subscribed") throw new Error("请先启用本设备后台提醒");
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("StudyFlow", { body: "测试提醒已成功送达", tag: "studyflow:test", icon: "icons/icon.svg" });
  },
};
