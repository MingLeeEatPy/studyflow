type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

export function isStudyFlowDesktop(): boolean {
  return typeof window !== "undefined" && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

type DesktopTimerAction = { action: "expand" | "finish"; kind: "study" | "meditation" };

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T | undefined> {
  if (!isStudyFlowDesktop()) return undefined;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export const desktopBridge = {
  isAvailable: isStudyFlowDesktop,
  showMain: () => invokeDesktop("reveal_studyflow_window", { label: "main" }),
  showTimer: () => invokeDesktop("reveal_studyflow_window", { label: "timer" }),
  hideMain: () => invokeDesktop("hide_studyflow_window", { label: "main" }),
  hideTimer: () => invokeDesktop("hide_studyflow_window", { label: "timer" }),
  async startDragging() {
    if (!isStudyFlowDesktop()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  },
  async notify(title: string, body: string) {
    if (!isStudyFlowDesktop()) return;
    const { isPermissionGranted, sendNotification } = await import("@tauri-apps/plugin-notification");
    if (await isPermissionGranted()) sendNotification({ title, body });
  },
  sendTimerAction(action: DesktopTimerAction["action"], kind: DesktopTimerAction["kind"]) {
    return invokeDesktop("send_desktop_timer_action", { action, kind });
  },
  async listenForTimerAction(callback: (action: DesktopTimerAction) => void) {
    if (!isStudyFlowDesktop()) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    return listen<DesktopTimerAction>("studyflow:desktop-timer-action", (event) => callback(event.payload));
  },
};
