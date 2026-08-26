import { describe, expect, it } from "vitest";
import { resolveCompletionSound } from "../src/features/focusAudio";

describe("结束提示音映射", () => {
  it("独立选择时保持用户所选提示音", () => {
    expect(resolveCompletionSound("stream-flute", "forest")).toBe("stream-flute");
  });

  it("随环境变化时映射各自然场景，并在环境音关闭时回退至风铃", () => {
    expect(resolveCompletionSound("follow-ambience", "forest")).toBe("forest-birds");
    expect(resolveCompletionSound("follow-ambience", "stream")).toBe("stream-flute");
    expect(resolveCompletionSound("follow-ambience", "campfire")).toBe("campfire-bell");
    expect(resolveCompletionSound("follow-ambience", "off")).toBe("wind-chime");
  });
});
