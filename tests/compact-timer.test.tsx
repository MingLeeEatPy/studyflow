import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompactTimerWidget } from "../src/components/CompactTimerWidget";
import { COMPACT_TIMER_PREFERENCE_KEY, loadCompactTimerPreference, saveCompactTimerPreference } from "../src/features/compactTimerPreference";

describe("CompactTimerWidget", () => {
  it("shows timer controls and invokes pause, expand and finish", () => {
    const pause = vi.fn(), expand = vi.fn(), finish = vi.fn();
    render(<CompactTimerWidget kind="study" title="线性代数" statusText="正在专注" seconds={65} paused={false} side="right" onSideChange={vi.fn()} onPositionChange={vi.fn()} onExpand={expand} onPause={pause} onResume={vi.fn()} onFinish={finish}/>);
    expect(screen.getByText("01:05")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "暂停计时" }));
    fireEvent.click(screen.getByRole("button", { name: "展开计时器" }));
    fireEvent.click(screen.getByRole("button", { name: "结束学习" }));
    expect(pause).toHaveBeenCalledOnce(); expect(expand).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledOnce();
  });

  it("supports keyboard side selection", () => {
    const change = vi.fn();
    render(<CompactTimerWidget kind="meditation" title="Meditation" statusText="正在冥想" seconds={30} paused={false} side="right" onSideChange={change} onPositionChange={vi.fn()} onExpand={vi.fn()} onPause={vi.fn()} onResume={vi.fn()} onFinish={vi.fn()}/>);
    fireEvent.keyDown(screen.getAllByRole("button", { name: /拖动微缩计时器/ }).at(-1)!, { key: "ArrowLeft" });
    expect(change).toHaveBeenCalledWith("left");
  });

  it("stores device-only preference", () => {
    localStorage.removeItem(COMPACT_TIMER_PREFERENCE_KEY);
    expect(loadCompactTimerPreference()).toEqual({ enabled: false, side: "right" });
    saveCompactTimerPreference({ enabled: true, side: "left" });
    expect(loadCompactTimerPreference()).toEqual({ enabled: true, side: "left" });
  });
});
