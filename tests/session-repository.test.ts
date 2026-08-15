import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StudyFlowDatabase } from "../src/db/database";
import { SessionRepository } from "../src/db/sessionRepository";
import { SettingsRepository } from "../src/db/settingsRepository";
import { TaskRepository } from "../src/db/taskRepository";

describe("V2 学习会话 Repository", () => {
  let db: StudyFlowDatabase;
  let sessions: SessionRepository;
  let tasks: TaskRepository;
  let now: Date;
  let idSequence: number;

  const clock = () => new Date(now);
  const createId = () => `generated-${++idSequence}`;
  const advance = (milliseconds: number) => { now = new Date(now.getTime() + milliseconds); };

  beforeEach(async () => {
    now = new Date("2026-08-14T00:00:00.000Z");
    idSequence = 0;
    db = new StudyFlowDatabase(`studyflow-session-test-${crypto.randomUUID()}`);
    tasks = new TaskRepository(db);
    sessions = new SessionRepository(db, clock, createId, tasks);
    await db.open();
  });

  afterEach(async () => db.delete());

  async function startStopwatch() {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    return sessions.startStopwatch({
      categoryId: category.id,
      title: "临时复习",
      goal: "完成第一章",
      timezone: "Asia/Shanghai",
    });
  }

  it("正计时暂停和恢复会关闭暂停区间，结束时排除暂停时长", async () => {
    const started = await startStopwatch();
    advance(30_000);
    const paused = await sessions.pause(started.id, started.revision);
    advance(30_000);
    const resumed = await sessions.resume(started.id, paused.revision);
    advance(31_000);
    const finished = await sessions.finish(started.id, {
      outcome: "completed", completeTask: false,
    }, resumed.revision);

    expect(finished).toMatchObject({ status: "finished", outcome: "completed" });
    const [savedInterval] = await db.studyIntervals.where("sessionId").equals(started.id).toArray();
    expect(savedInterval.pauses).toEqual([{
      startedAt: "2026-08-14T00:00:30.000Z",
      endedAt: "2026-08-14T00:01:00.000Z",
    }]);
  });

  it("有效专注不足 60 秒时丢弃会话及全部区间", async () => {
    const started = await startStopwatch();
    advance(59_999);
    expect(await sessions.finish(started.id, { outcome: "completed" }, started.revision)).toBeNull();
    expect(await db.studySessions.get(started.id)).toBeUndefined();
    expect(await db.studyIntervals.where("sessionId").equals(started.id).count()).toBe(0);
  });

  it("达到设置的 4 小时阈值后自动暂停且不会重复暂停", async () => {
    const started = await startStopwatch();
    advance(4 * 60 * 60_000);
    const paused = await sessions.autoPauseIfNeeded(started.id, started.revision);
    expect(paused.status).toBe("paused");
    const unchanged = await sessions.autoPauseIfNeeded(started.id, paused.revision);
    expect(unchanged).toEqual(paused);
  });

  it("正计时自动暂停按最近一次恢复后的连续时长计算", async () => {
    const started = await startStopwatch();
    advance(3 * 60 * 60_000);
    const paused = await sessions.pause(started.id, started.revision);
    advance(60_000);
    const resumed = await sessions.resume(started.id, paused.revision);
    advance(3 * 60 * 60_000);
    expect(await sessions.autoPauseIfNeeded(started.id, resumed.revision)).toMatchObject({ status: "running" });
    advance(60 * 60_000);
    expect(await sessions.autoPauseIfNeeded(started.id, resumed.revision)).toMatchObject({ status: "paused" });
  });

  it("番茄阶段只在确认后切换，并分别保存 focus 与 break 区间", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    const started = await sessions.startPomodoro({
      categoryId: category.id, title: "番茄学习", timezone: "Asia/Shanghai",
    });
    advance(25 * 60_000);
    const focusDone = await sessions.completeCurrentStage(started.id, started.revision);
    expect(focusDone.status).toBe("awaiting-confirmation");
    const onBreak = await sessions.advancePomodoro(started.id, "start-break", focusDone.revision);
    expect(onBreak).toMatchObject({ status: "running", pomodoroRound: 1 });
    advance(5 * 60_000);
    const breakDone = await sessions.completeCurrentStage(started.id, onBreak.revision);
    const nextFocus = await sessions.advancePomodoro(started.id, "start-focus", breakDone.revision);
    expect(nextFocus.pomodoroRound).toBe(2);
    expect((await db.studyIntervals.where("sessionId").equals(started.id).toArray()).map((i) => i.kind))
      .toEqual(["focus", "break", "focus"]);
  });

  it("专注到时后保持区间开放并累计超时，开始休息时才关闭", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    const started = await sessions.startPomodoro({
      categoryId: category.id, title: "超时专注", timezone: "Asia/Shanghai",
      pomodoroSettings: { focusMinutes: 1, shortBreakMinutes: 5, longBreakMinutes: 15, roundsPerSet: 4 },
    });
    advance(60_000);
    const overtime = await sessions.completeCurrentStage(started.id, started.revision);
    expect(overtime.status).toBe("awaiting-confirmation");
    expect((await sessions.listIntervals(started.id))[0].endedAt).toBeNull();

    advance(30_000);
    const onBreak = await sessions.advancePomodoro(started.id, "start-break", overtime.revision);
    const intervals = await sessions.listIntervals(started.id);
    expect(intervals[0].endedAt).toBe("2026-08-14T00:01:30.000Z");
    expect(intervals[1]).toMatchObject({ kind: "break", startedAt: "2026-08-14T00:01:30.000Z" });
    expect(onBreak.status).toBe("running");
  });

  it("超时正计时发生休眠时，处理后恢复到等待休息状态", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    const started = await sessions.startPomodoro({
      categoryId: category.id, title: "超时休眠", timezone: "Asia/Shanghai",
      pomodoroSettings: { focusMinutes: 1, shortBreakMinutes: 5, longBreakMinutes: 15, roundsPerSet: 4 },
    });
    advance(60_000);
    const overtime = await sessions.completeCurrentStage(started.id, started.revision);
    advance(30_000);
    const reviewing = await sessions.reportSleepGap(
      started.id, "2026-08-14T00:01:00.000Z", "2026-08-14T00:01:30.000Z", overtime.revision,
    );
    const resolved = await sessions.resolveSleepGap(started.id, {
      intervalId: started.activeIntervalId!, gapIndex: 0, resolution: "exclude",
    }, reviewing.revision);
    expect(resolved.status).toBe("awaiting-confirmation");
  });

  it("每条番茄会话可覆盖默认设置，运行中修改只影响后续阶段", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    const settings = new SettingsRepository(db, clock);
    const started = await sessions.startPomodoro({
      categoryId: category.id, title: "45 分钟高数", timezone: "Asia/Shanghai",
      pomodoroSettings: { focusMinutes: 45, shortBreakMinutes: 5, longBreakMinutes: 10, roundsPerSet: 3 },
    });
    expect(started.pomodoroSettingsSnapshot).toEqual({
      focusMinutes: 45, shortBreakMinutes: 5, longBreakMinutes: 10, roundsPerSet: 3,
    });
    const firstInterval = (await sessions.listIntervals(started.id))[0];
    expect(firstInterval.targetSeconds).toBe(45 * 60);
    expect((await settings.getExecutionSettings()).focusMinutes).toBe(25);

    const updated = await sessions.updatePomodoroSettings(started.id, {
      focusMinutes: 30, shortBreakMinutes: 8, longBreakMinutes: 20, roundsPerSet: 4,
    }, started.revision);
    expect((await sessions.listIntervals(started.id))[0].targetSeconds).toBe(45 * 60);
    await expect(sessions.updatePomodoroSettings(started.id, {
      focusMinutes: 20, shortBreakMinutes: 5, longBreakMinutes: 15, roundsPerSet: 4,
    }, started.revision)).rejects.toThrow(/其他标签页|更新/);

    advance(45 * 60_000);
    const focusDone = await sessions.completeCurrentStage(updated.id, updated.revision);
    const onBreak = await sessions.advancePomodoro(updated.id, "start-break", focusDone.revision);
    expect((await sessions.listIntervals(onBreak.id)).at(-1)?.targetSeconds).toBe(8 * 60);
  });

  it("运行中的番茄休息可以跳过并直接开始下一轮专注", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    const started = await sessions.startPomodoro({
      categoryId: category.id, title: "跳过休息", timezone: "Asia/Shanghai",
    });
    advance(25 * 60_000);
    const focusDone = await sessions.completeCurrentStage(started.id, started.revision);
    const onBreak = await sessions.advancePomodoro(started.id, "start-break", focusDone.revision);
    advance(60_000);
    const nextFocus = await sessions.advancePomodoro(started.id, "skip-break", onBreak.revision);
    expect(nextFocus).toMatchObject({ status: "running", pomodoroRound: 2 });
    const intervals = await sessions.listIntervals(started.id);
    expect(intervals.map((item) => item.kind)).toEqual(["focus", "break", "focus"]);
    expect(intervals[1].endedAt).toBe("2026-08-14T00:26:00.000Z");
  });

  it("第 4 轮专注后创建使用 longBreakMinutes 的长休息区间", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    let current = await sessions.startPomodoro({
      categoryId: category.id, title: "四轮番茄", timezone: "Asia/Shanghai",
    });
    for (let round = 1; round <= 4; round += 1) {
      advance(25 * 60_000);
      current = await sessions.completeCurrentStage(current.id, current.revision);
      current = await sessions.advancePomodoro(current.id, "start-break", current.revision);
      const breakInterval = (await sessions.listIntervals(current.id)).at(-1)!;
      expect(breakInterval.kind).toBe("break");
      expect(breakInterval.targetSeconds).toBe((round === 4 ? 15 : 5) * 60);
      if (round < 4) {
        advance(5 * 60_000);
        current = await sessions.completeCurrentStage(current.id, current.revision);
        current = await sessions.advancePomodoro(current.id, "start-focus", current.revision);
      }
    }
  });

  it("休眠间隔在解决前阻止普通状态，并支持排除和修正", async () => {
    const started = await startStopwatch();
    advance(30 * 60_000);
    const reviewing = await sessions.reportSleepGap(
      started.id,
      "2026-08-14T00:10:00.000Z",
      "2026-08-14T00:30:00.000Z",
      started.revision,
    );
    expect(reviewing.status).toBe("sleep-review");
    const resolved = await sessions.resolveSleepGap(started.id, {
      intervalId: started.activeIntervalId!, gapIndex: 0, resolution: "exclude",
    }, reviewing.revision);
    expect(resolved.status).toBe("running");
    expect((await db.studyIntervals.get(started.activeIntervalId!))?.sleepGaps[0].resolution).toBe("exclude");
  });

  it("休眠间隔未处理前拒绝结束，避免把可疑时段永久计入", async () => {
    const started = await startStopwatch();
    advance(61_000);
    const reviewing = await sessions.reportSleepGap(
      started.id,
      "2026-08-14T00:00:30.000Z",
      "2026-08-14T00:01:01.000Z",
      started.revision,
    );
    await expect(sessions.finish(reviewing.id, { outcome: "completed" }, reviewing.revision))
      .rejects.toThrow(/先处理.*休眠/);
    expect((await sessions.getActive())?.status).toBe("sleep-review");
  });

  it("刷新或重开数据库后恢复同一条活动会话", async () => {
    const started = await startStopwatch();
    const dbName = db.name;
    db.close();
    db = new StudyFlowDatabase(dbName);
    sessions = new SessionRepository(db, clock, createId, new TaskRepository(db));
    expect(await sessions.getActive()).toMatchObject({ id: started.id, status: "running" });
  });

  it("expectedRevision 防止旧标签页重复修改状态", async () => {
    const started = await startStopwatch();
    const paused = await sessions.pause(started.id, started.revision);
    await expect(sessions.resume(started.id, started.revision)).rejects.toThrow(/其他标签页|更新/);
    expect((await sessions.getActive())?.revision).toBe(paused.revision);
  });

  it("两个标签页同时结束同一 revision 时仅允许一次成功", async () => {
    const started = await startStopwatch();
    advance(61_000);
    const results = await Promise.allSettled([
      sessions.finish(started.id, { outcome: "completed" }, started.revision),
      sessions.finish(started.id, { outcome: "completed" }, started.revision),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
  });

  it("完成关联任务时同步任务状态，但未勾选时保持任务未完成", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    const task = await tasks.create({
      title: "完成作业", categoryId: category.id, estimatedMinutes: 30,
      dueDate: "2026-08-14", important: true, urgent: false,
    });
    const first = await sessions.startStopwatch({ taskId: task.id, categoryId: category.id, timezone: "Asia/Shanghai" });
    advance(61_000);
    await sessions.finish(first.id, { outcome: "completed", completeTask: false }, first.revision);
    expect((await tasks.get(task.id)).completed).toBe(false);

    const second = await sessions.startStopwatch({ taskId: task.id, categoryId: category.id, timezone: "Asia/Shanghai" });
    advance(61_000);
    await sessions.finish(second.id, { outcome: "completed", completeTask: true }, second.revision);
    expect((await tasks.get(task.id)).completed).toBe(true);
  });

  it("部分完成必须选择原因，历史筛选按 outcome 工作", async () => {
    const started = await startStopwatch();
    advance(61_000);
    await expect(sessions.finish(started.id, { outcome: "partial" }, started.revision)).rejects.toThrow();
    await sessions.finish(started.id, {
      outcome: "partial", failureReason: "interrupted", summary: "完成一半",
    }, started.revision);
    expect(await sessions.listHistory({ outcome: "completed" })).toEqual([]);
    expect(await sessions.listHistory({ outcome: "partial" })).toHaveLength(1);
  });

  it("历史修正必须填写原因并保留修正前后的审计记录", async () => {
    const started = await startStopwatch();
    advance(61_000);
    const finished = (await sessions.finish(started.id, { outcome: "completed" }, started.revision))!;
    await expect(sessions.correct(finished.id, { session: { note: "修正" }, reason: " " })).rejects.toThrow(/原因/);
    const corrected = await sessions.correct(finished.id, {
      session: { outcome: "unfinished", failureReason: "low-energy" }, reason: "复盘后修正",
    });
    expect(corrected).toMatchObject({ outcome: "unfinished", failureReason: "low-energy" });
    const revision = await db.sessionRevisions.where("sessionId").equals(finished.id).first();
    expect(revision).toMatchObject({
      reason: "复盘后修正",
      before: { session: { outcome: "completed" }, intervals: expect.any(Array) },
      after: { session: { outcome: "unfinished" }, intervals: expect.any(Array) },
    });
  });

  it("历史修正拒绝重叠阶段且失败时不破坏原时间线", async () => {
    const started = await startStopwatch();
    advance(61_000);
    const finished = (await sessions.finish(started.id, { outcome: "completed" }, started.revision))!;
    const original = await sessions.listIntervals(finished.id);
    const duplicate = {
      ...structuredClone(original[0]), id: "overlapping-interval", startedAt: original[0].startedAt,
    };
    await expect(sessions.correct(finished.id, {
      intervals: [...original, duplicate], reason: "错误修正",
    }, finished.revision)).rejects.toThrow(/新增或删除/);
    expect(await sessions.listIntervals(finished.id)).toEqual(original);
    expect(await db.sessionRevisions.where("sessionId").equals(finished.id).count()).toBe(0);
  });

  it("设置使用 V2 默认值，更新时执行范围校验", async () => {
    const settings = new SettingsRepository(db, clock);
    expect(await settings.getExecutionSettings()).toMatchObject({
      focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15,
      roundsPerSet: 4, stopwatchAutoPauseMinutes: 240,
    });
    expect((await settings.updateExecutionSettings({ focusMinutes: 50 })).focusMinutes).toBe(50);
    await expect(settings.updateExecutionSettings({ focusMinutes: 0 })).rejects.toThrow();
  });
});

describe("V1 到 V2 IndexedDB migration", () => {
  it("保留 V1 任务数据，并创建 V2 设置和执行数据表", async () => {
    const name = `studyflow-v1-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      tasks: "id, categoryId, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
    });
    await legacy.open();
    const timestamp = "2026-08-14T00:00:00.000Z";
    await legacy.table("categories").add({
      id: "legacy-category", name: "旧分类", sortOrder: 0, archivedAt: null,
      createdAt: timestamp, updatedAt: timestamp,
    });
    await legacy.table("tasks").add({
      id: "legacy-task", title: "旧任务", categoryId: "legacy-category", estimatedMinutes: 30,
      dueDate: "2026-08-14", important: false, urgent: false, completed: false,
      completedAt: null, archivedAt: null, createdAt: timestamp, updatedAt: timestamp,
    });
    legacy.close();

    const upgraded = new StudyFlowDatabase(name);
    await upgraded.open();
    expect(await upgraded.tasks.get("legacy-task")).toMatchObject({ title: "旧任务" });
    expect(await upgraded.executionSettings.get("default")).toMatchObject({ focusMinutes: 25 });
    expect(await upgraded.studySessions.count()).toBe(0);
    await upgraded.delete();
  });
});
