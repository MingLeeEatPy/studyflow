type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

export function isStudyFlowDesktop(): boolean {
  return typeof window !== "undefined" && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

async function getWindow(label: "main" | "timer") {
  if (!isStudyFlowDesktop()) return null;
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return WebviewWindow.getByLabel(label);
}

async function reveal(label: "main" | "timer") {
  const target = await getWindow(label);
  if (!target) return;
  await target.unminimize();
  await target.show();
  await target.setFocus();
}

export const desktopBridge = {
  isAvailable: isStudyFlowDesktop,
  showMain: () => reveal("main"),
  showTimer: () => reveal("timer"),
  async hideMain() {
    const target = await getWindow("main");
    await target?.hide();
  },
  async hideTimer() {
    const target = await getWindow("timer");
    await target?.hide();
  },
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
};
