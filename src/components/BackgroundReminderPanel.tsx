import { useCallback, useEffect, useState } from "react";
import { reminderService, type BackgroundReminderStatus } from "../features/reminderService";

const labels: Record<BackgroundReminderStatus, string> = {
  unsupported: "当前浏览器不支持后台推送；请尝试从 Safari 将 StudyFlow 添加到主屏幕",
  "signed-out": "登录后才能安排后台提醒",
  "permission-required": "尚未启用",
  subscribed: "本设备已启用后台提醒",
  denied: "通知权限已被系统拒绝，请到系统设置中允许 StudyFlow 通知",
  offline: "当前离线，返回前台后仍会校正时间",
  "not-configured": "线上环境尚未配置推送服务",
  error: "后台提醒暂时不可用",
};

export function BackgroundReminderPanel({ onEnableNotifications }: { onEnableNotifications: () => Promise<void> }) {
  const [status, setStatus] = useState<BackgroundReminderStatus>("permission-required");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(() => { void reminderService.getStatus().then(setStatus).catch(() => setStatus("error")); }, []);
  useEffect(refresh, [refresh]);
  const run = async (action: () => Promise<void | BackgroundReminderStatus>) => {
    setBusy(true); setMessage("");
    try { const next = await action(); if (next) setStatus(next); else refresh(); }
    catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
  };
  return <section className="background-reminder-card"><div><h2>本设备后台提醒</h2><p>{labels[status]}</p><small>StudyFlow 负责计时和到点提醒；ScreenZen 继续负责屏蔽分心 App。PWA 推送通常在到点后 0～60 秒内送达。</small></div><div className="background-reminder-actions">
    {status !== "subscribed" && <button className="button secondary" type="button" disabled={busy || status === "not-configured" || status === "unsupported"} onClick={() => void run(async () => { const next = await reminderService.subscribe(); if (next === "subscribed") await onEnableNotifications(); return next; })}>启用本设备后台提醒</button>}
    {status === "subscribed" && <><button className="button secondary" type="button" disabled={busy} onClick={() => void run(() => reminderService.sendTest())}>发送测试提醒</button><button className="button secondary" type="button" disabled={busy} onClick={() => void run(() => reminderService.unsubscribe())}>关闭本设备后台提醒</button></>}
  </div>{message && <p role="status" className="inline-warning">{message}</p>}</section>;
}
