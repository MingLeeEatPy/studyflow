import { describe, expect, it } from "vitest";
import { cancelDeviceReminders, getDeviceReminder, putDeviceReminder } from "../src/features/deviceReminderStore";
import { base64UrlToUint8Array, reminderService } from "../src/features/reminderService";
import { parseStudyFlowPushPayload, reminderNotification } from "../src/features/reminderPayload";

describe("reminder service", () => {
  it("decodes a VAPID base64url key", () => {
    expect(Array.from(base64UrlToUint8Array("AQIDBA"))).toEqual([1, 2, 3, 4]);
  });

  it("reports an unconfigured environment without requesting permission", async () => {
    expect(await reminderService.getStatus()).toBe("not-configured");
  });

  it("keeps the current local reminder and cancels older revisions", async () => {
    await putDeviceReminder({ id: "old:1", intervalId: "old", revision: 1, dueAt: new Date().toISOString(), state: "scheduled" });
    await putDeviceReminder({ id: "current:2", intervalId: "current", revision: 2, dueAt: new Date().toISOString(), state: "scheduled" });
    await cancelDeviceReminders("current:2");
    expect((await getDeviceReminder("old:1"))?.state).toBe("cancelled");
    expect((await getDeviceReminder("current:2"))?.state).toBe("scheduled");
  });

  it("validates a push payload and creates a privacy-safe notification", () => {
    const payload = parseStudyFlowPushPayload({ intervalId: "focus-1", revision: 4, kind: "focus", title: "不应出现在锁屏" });
    expect(payload).not.toBeNull();
    expect(reminderNotification(payload!)).toEqual({ body: "本轮专注时间已到", tag: "studyflow:focus-1:4", url: "./#focus" });
    expect(parseStudyFlowPushPayload({ intervalId: "", revision: "4" })).toBeNull();
  });
});
