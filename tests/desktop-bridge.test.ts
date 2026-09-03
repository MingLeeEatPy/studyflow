import { describe, expect, it } from "vitest";
import desktopConfig from "../src-tauri/tauri.conf.json";
import { isStudyFlowDesktop, isTauriDesktopOrigin } from "../src/desktop/desktopBridge";

describe("desktop bridge", () => {
  it("is inactive in a normal browser", () => {
    expect(isStudyFlowDesktop()).toBe(false);
  });

  it("recognizes the official Tauri production marker", () => {
    const previous = (window as Window & { isTauri?: boolean }).isTauri;
    (window as Window & { isTauri?: boolean }).isTauri = true;
    expect(isStudyFlowDesktop()).toBe(true);
    if (previous === undefined) delete (window as Window & { isTauri?: boolean }).isTauri;
    else (window as Window & { isTauri?: boolean }).isTauri = previous;
  });

  it("recognizes Tauri's installed-app localhost origin without an internal bridge", () => {
    expect(isTauriDesktopOrigin({ hostname: "tauri.localhost", protocol: "http:" })).toBe(true);
    expect(isTauriDesktopOrigin({ hostname: "studyflow.2442066641.workers.dev", protocol: "https:" })).toBe(false);
  });

  it("explicitly enables Tauri globals in the installer configuration", () => {
    expect(desktopConfig.app.withGlobalTauri).toBe(true);
    expect(desktopConfig.plugins.updater.endpoints).toEqual(["https://studyflow.2442066641.workers.dev/desktop/latest.json"]);
  });
});
