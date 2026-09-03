import { describe, expect, it, vi } from "vitest";
import { createDesktopUpdater } from "../src/desktop/desktopUpdater";

describe("desktop updater", () => {
  it("reports an available update before installation", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    const updater = createDesktopUpdater({
      isDesktop: () => true,
      checkForUpdate: async () => ({ version: "0.4.2", body: "修复计时器", downloadAndInstall }),
      relaunch: async () => undefined,
    });

    await expect(updater.check()).resolves.toEqual({ status: "available", version: "0.4.2", notes: "修复计时器" });
  });

  it("does not load native updater APIs in a browser", async () => {
    const updater = createDesktopUpdater({ isDesktop: () => false });
    await expect(updater.check()).resolves.toEqual({ status: "unsupported" });
  });

  it("explains an unconfigured update service without affecting the app", async () => {
    const updater = createDesktopUpdater({
      isDesktop: () => true,
      checkForUpdate: async () => { throw new Error("updater configuration missing pubkey"); },
      relaunch: async () => undefined,
    });
    await expect(updater.check()).resolves.toEqual({ status: "failed", message: "更新服务尚未配置；不会影响当前使用。" });
  });

  it("reports download progress and relaunches after installing", async () => {
    const relaunch = vi.fn().mockResolvedValue(undefined);
    const updater = createDesktopUpdater({
      isDesktop: () => true,
      checkForUpdate: async () => ({
        version: "0.4.2",
        downloadAndInstall: async (onEvent) => {
          onEvent({ event: "Started", data: { contentLength: 10 } });
          onEvent({ event: "Progress", data: { chunkLength: 5 } });
          onEvent({ event: "Finished" });
        },
      }),
      relaunch,
    });
    await updater.check();
    const states: string[] = [];
    await updater.install((state) => states.push(state.status));

    expect(states).toContain("downloading");
    expect(relaunch).toHaveBeenCalledOnce();
  });
});
