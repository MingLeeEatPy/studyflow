import { describe, expect, it } from "vitest";
import { isStudyFlowDesktop } from "../src/desktop/desktopBridge";

describe("desktop bridge", () => {
  it("is inactive in a normal browser", () => {
    expect(isStudyFlowDesktop()).toBe(false);
  });
});
