/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { getDeviceReminder, reminderRecordId } from "./features/deviceReminderStore";
import { parseStudyFlowPushPayload, reminderNotification } from "./features/reminderPayload";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision?: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload: ReturnType<typeof parseStudyFlowPushPayload>;
    try {
      payload = parseStudyFlowPushPayload(event.data?.json());
      if (!payload) return;
    } catch { return; }

    try {
      const local = await getDeviceReminder(reminderRecordId(payload.intervalId, payload.revision));
      if (local?.state === "cancelled") return;
    } catch { /* 存储暂时不可读时优先提醒，避免完全漏报 */ }

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows.some((client) => client.visibilityState === "visible")) return;
    const notification = reminderNotification(payload);
    await self.registration.showNotification("StudyFlow", {
      body: notification.body,
      tag: notification.tag,
      icon: "icons/icon.svg",
      badge: "icons/icon.svg",
      data: { url: notification.url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL((event.notification.data as { url?: string } | undefined)?.url ?? "./#focus", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows[0];
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
