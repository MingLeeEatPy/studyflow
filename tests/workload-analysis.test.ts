import { describe, expect, it } from "vitest";
import { analysisRange, buildCategoryWorkload } from "../src/domain/workloadAnalysis";

describe("workload analysis", () => {
  it("uses Monday through Sunday for a weekly range", () => expect(analysisRange("week", "2026-09-02")).toMatchObject({ from: "2026-08-31", to: "2026-09-06" }));
  it("compares completed action distribution with planned actions", () => {
    const stamp = "2026-09-02T10:00:00.000+08:00", range = analysisRange("week", "2026-09-02");
    const rows = buildCategoryWorkload({ categories: [{ id: "math", name: "数学", archivedAt: null }, { id: "c", name: "C", archivedAt: null }] as never, tasks: [
      { categoryId: "math", completed: true, completedAt: stamp }, { categoryId: "c", completed: true, completedAt: stamp },
    ] as never, sessions: [], intervalsBySession: {}, targets: [{ categoryId: "math", plannedActions: 3 }, { categoryId: "c", plannedActions: 1 }], range });
    expect(rows.find((row) => row.categoryId === "math")).toMatchObject({ plannedShare: 0.75, completedShare: 0.5, deviationPoints: -25 });
  });
});
