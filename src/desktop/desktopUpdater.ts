import { isStudyFlowDesktop } from "./desktopBridge";

export type DesktopUpdateState =
  | { status: "idle" | "checking" | "up-to-date" | "unsupported" }
  | { status: "available"; version: string; notes: string | null }
  | { status: "downloading"; percent: number | null }
  | { status: "failed"; message: string };

type UpdateHandle = {
  version: string;
  body?: string;
  downloadAndInstall: (onEvent: (event: { event: "Started"; data: { contentLength?: number } } | { event: "Progress"; data: { chunkLength: number } } | { event: "Finished" }) => void) => Promise<void>;
};

type UpdaterDependencies = {
  isDesktop: () => boolean;
  checkForUpdate?: () => Promise<UpdateHandle | null>;
  relaunch?: () => Promise<void>;
};

export type DesktopUpdater = {
  check: () => Promise<DesktopUpdateState>;
  install: (onState: (state: DesktopUpdateState) => void) => Promise<void>;
};

function errorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : "未知错误";
  if (/pubkey|endpoint|updater.*config/i.test(detail)) return "更新服务尚未配置；不会影响当前使用。";
  return `桌面版更新暂时不可用：${detail}`;
}

export function createDesktopUpdater(dependencies: UpdaterDependencies = { isDesktop: isStudyFlowDesktop }): DesktopUpdater {
  let pendingUpdate: UpdateHandle | null = null;

  async function getDependencies(): Promise<Required<Pick<UpdaterDependencies, "checkForUpdate" | "relaunch">> | null> {
    if (!dependencies.isDesktop()) return null;
    if (dependencies.checkForUpdate && dependencies.relaunch) return { checkForUpdate: dependencies.checkForUpdate, relaunch: dependencies.relaunch };
    const [{ check }, { relaunch }] = await Promise.all([
      import("@tauri-apps/plugin-updater"),
      import("@tauri-apps/plugin-process"),
    ]);
    return { checkForUpdate: check, relaunch };
  }

  return {
    async check() {
      pendingUpdate = null;
      try {
        const runtime = await getDependencies();
        if (!runtime) return { status: "unsupported" };
        const update = await runtime.checkForUpdate();
        if (!update) return { status: "up-to-date" };
        pendingUpdate = update;
        return { status: "available", version: update.version, notes: update.body ?? null };
      } catch (error) {
        return { status: "failed", message: errorMessage(error) };
      }
    },
    async install(onState) {
      if (!pendingUpdate) return;
      try {
        let downloaded = 0;
        let contentLength: number | undefined;
        onState({ status: "downloading", percent: null });
        await pendingUpdate.downloadAndInstall((event) => {
          if (event.event === "Started") contentLength = event.data.contentLength;
          if (event.event === "Progress") {
            downloaded += event.data.chunkLength;
            onState({ status: "downloading", percent: contentLength ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : null });
          }
        });
        const runtime = await getDependencies();
        if (runtime) await runtime.relaunch();
      } catch (error) {
        onState({ status: "failed", message: errorMessage(error) });
      }
    },
  };
}

export const desktopUpdater = createDesktopUpdater();
