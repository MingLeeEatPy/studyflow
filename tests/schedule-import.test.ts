import { describe, expect, it } from "vitest";
import { parseScheduleImport, suggestActionDates } from "../src/domain/scheduleImport";

describe("通用课表导入", () => {
  it("解析 CSV 预览，不会在解析阶段创建任务", () => {
    expect(parseScheduleImport("schedule.csv", "title,date,minutes\n线性代数,2026-09-01,90")).toEqual([
      { title: "线性代数", dueDate: "2026-09-01", estimatedMinutes: 90 },
    ]);
  });

  it("解析 iCalendar 的课程事件", () => {
    expect(parseScheduleImport("schedule.ics", "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:CS50 Week 2\nDTSTART:20260903T090000\nEND:VEVENT\nEND:VCALENDAR")).toEqual([
      { title: "CS50 Week 2", dueDate: "2026-09-03", estimatedMinutes: 60 },
    ]);
  });

  it("只生成可编辑的日期建议", () => {
    expect(suggestActionDates("2026-09-01", "2026-09-07", 3)).toEqual(["2026-09-01", "2026-09-03", "2026-09-05"]);
  });
});
