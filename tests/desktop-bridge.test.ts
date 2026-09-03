import { describe, expect, it } from "vitest";
import { isStudyFlowDesktop } from "../src/desktop/desktopBridge";

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
});
