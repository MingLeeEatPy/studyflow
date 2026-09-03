import { describe, expect, it } from "vitest";
import { analysisRange, buildCategoryWorkload, nextWeekAdvice } from "../src/domain/workloadAnalysis";

describe("workload analysis", () => {
  it("uses Monday through Sunday for a weekly range", () => expect(analysisRange("week", "2026-09-02")).toMatchObject({ from: "2026-08-31", to: "2026-09-06" }));
  it("compares completed action distribution with planned actions", () => {
    const stamp = "2026-09-02T10:00:00.000+08:00", range = analysisRange("week", "2026-09-02");
    const rows = buildCategoryWorkload({ categories: [{ id: "math", name: "数学", archivedAt: null }, { id: "c", name: "C", archivedAt: null }] as never, tasks: [
      { categoryId: "math", completed: true, completedAt: stamp }, { categoryId: "c", completed: true, completedAt: stamp },
    ] as never, sessions: [], intervalsBySession: {}, plan: { id: "week:2026-08-31", weekStart: "2026-08-31", totalPlannedActions: 4, allocations: [{ categoryId: "math", categoryNameSnapshot: "数学", plannedActions: 3 }, { categoryId: "c", categoryNameSnapshot: "C", plannedActions: 1 }], createdAt: stamp, updatedAt: stamp }, range });
    expect(rows.find((row) => row.categoryId === "math")).toMatchObject({ plannedShare: 0.75, completedShare: 0.5, remainingActions: 2 });
  });
  it("gives a conservative next-week suggestion when the minimum plan was not met", () => {
    const advice = nextWeekAdvice([{ categoryId: "math", categoryName: "数学", plannedActions: 6, completedActions: 2, focusSeconds: 0, averageFocusSeconds: null, plannedShare: 1, completedShare: 1, remainingActions: 4 }], { id: "week", weekStart: "2026-08-31", totalPlannedActions: 6, allocations: [{ categoryId: "math", categoryNameSnapshot: "数学", plannedActions: 6 }], createdAt: "2026-09-01T00:00:00.000+08:00", updatedAt: "2026-09-01T00:00:00.000+08:00" }, []);
    expect(advice[0]).toContain("最低总量定为 1 个行动");
    expect(advice.some((item) => item.includes("数学 还差 4 个行动"))).toBe(true);
  });
});
