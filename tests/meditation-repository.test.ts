import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StudyFlowDatabase } from "../src/db/database";
import { MeditationRepository } from "../src/db/meditationRepository";
import { SessionRepository } from "../src/db/sessionRepository";
import { totalMeditationMs } from "../src/domain/meditation";

describe("Meditation Repository", () => {
  let db: StudyFlowDatabase;
  let meditation: MeditationRepository;
  let now: Date;
  let sequence: number;

  const clock = () => new Date(now);
  const createId = () => `meditation-id-${++sequence}`;
  const advance = (milliseconds: number) => { now = new Date(now.getTime() + milliseconds); };

  beforeEach(async () => {
    now = new Date("2026-08-14T00:00:00.000Z");
    sequence = 0;
    db = new StudyFlowDatabase(`studyflow-meditation-test-${crypto.randomUUID()}`);
    meditation = new MeditationRepository(db, clock, createId);
    await db.open();
  });

  afterEach(async () => db.delete());

  async function startFree(breathingPattern: "4-7-8" | "balanced" | "box" | "none" = "none") {
    return meditation.start({
      mode: "free",
      targetMinutes: null,
      intention: "calm",
      intentionNote: "观察呼吸",
      breathingPattern,
      timezone: "Asia/Shanghai",
    });
  }

  it("timed 与 free 保存不同目标，none 会直接进入核心冥想", async () => {
    const timed = await meditation.start({
      mode: "timed", targetMinutes: 5, intention: "refocus", intentionNote: "",
      breathingPattern: "none", timezone: "Asia/Shanghai",
    });
    expect(timed).toMatchObject({ status: "running", targetSeconds: 300, meditationStartedAt: now.toISOString() });
    expect(await meditation.listIntervals(timed.id)).toMatchObject([{ kind: "meditation", targetSeconds: 300 }]);
    await meditation.discard(timed.id);

    const free = await startFree();
    expect(free).toMatchObject({ status: "running", targetSeconds: null, meditationStartedAt: now.toISOString() });
    expect(await meditation.listIntervals(free.id)).toMatchObject([{ kind: "meditation", targetSeconds: null }]);
  });

  it("呼吸引导可提前跳过，关闭呼吸区间后才开始核心冥想", async () => {
    const started = await startFree("4-7-8");
    expect(started).toMatchObject({ status: "breathing", breathingRounds: 4, meditationStartedAt: null });
    expect(await meditation.listIntervals(started.id)).toMatchObject([{ kind: "breathing", targetSeconds: 76, endedAt: null }]);

    advance(10_000);
    const running = await meditation.beginOrSkipBreathing(started.id, started.revision);
    expect(running).toMatchObject({ status: "running", revision: 1, meditationStartedAt: now.toISOString() });
    expect(await meditation.listIntervals(started.id)).toMatchObject([
      { kind: "breathing", endedAt: now.toISOString() },
      { kind: "meditation", startedAt: now.toISOString(), targetSeconds: null },
    ]);
  });

  it("暂停时间不计入有效冥想，恢复后结束会闭合暂停并保存花朵", async () => {
    const started = await startFree();
    advance(30_000);
    const paused = await meditation.pause(started.id, started.revision);
    advance(40_000);
    const resumed = await meditation.resume(started.id, paused.revision);
    advance(31_000);
    const finished = await meditation.finish(resumed.id, { feeling: 4, note: "更平静" }, resumed.revision);

    expect(finished).toMatchObject({ status: "finished", feeling: 4, note: "更平静" });
    const intervals = await meditation.listIntervals(started.id);
    expect(totalMeditationMs(intervals)).toBe(61_000);
    expect(intervals[0].pauses).toEqual([{
      startedAt: "2026-08-14T00:00:30.000Z",
      endedAt: "2026-08-14T00:01:10.000Z",
    }]);
    expect(await db.growthRecords.where("sourceSessionId").equals(started.id).first()).toMatchObject({
      sourceType: "meditation", plantType: "flower", targetSecondsSnapshot: 10 * 60,
      localDate: "2026-08-14", timezone: "Asia/Shanghai",
    });
  });

  it("未解决的休眠间隔阻止结束，排除后按真实时长生成花朵", async () => {
    const started = await startFree();
    advance(120_000);
    const reviewing = await meditation.reportSleepGap(
      started.id,
      "2026-08-14T00:00:30.000Z",
      "2026-08-14T00:01:30.000Z",
      started.revision,
    );
    await expect(meditation.finish(reviewing.id, {}, reviewing.revision)).rejects.toThrow(/先处理.*休眠/);
    const interval = (await meditation.listIntervals(started.id))[0];
    const running = await meditation.resolveSleepGap(reviewing.id, {
      intervalId: interval.id, gapIndex: 0, resolution: "exclude",
    }, reviewing.revision);
    const finished = await meditation.finish(running.id, {}, running.revision);
    expect(finished?.status).toBe("finished");
    expect(totalMeditationMs(await meditation.listIntervals(started.id))).toBe(60_000);
    expect(await db.growthRecords.where("sourceSessionId").equals(started.id).count()).toBe(1);
  });

  it("核心冥想不足 60 秒时丢弃 session、interval 和成长记录", async () => {
    const started = await startFree();
    advance(59_999);
    expect(await meditation.finish(started.id, {}, started.revision)).toBeNull();
    expect(await db.meditationSessions.get(started.id)).toBeUndefined();
    expect(await db.meditationIntervals.where("sessionId").equals(started.id).count()).toBe(0);
    expect(await db.growthRecords.where("sourceSessionId").equals(started.id).count()).toBe(0);
  });

  it("有效 timed 冥想按目标快照生成花朵", async () => {
    const started = await meditation.start({
      mode: "timed", targetMinutes: 5, intention: "observe", intentionNote: "",
      breathingPattern: "none", timezone: "Asia/Shanghai",
    });
    advance(61_000);
    await meditation.finish(started.id, {}, started.revision);
    expect(await db.growthRecords.where("sourceSessionId").equals(started.id).first()).toMatchObject({
      sourceType: "meditation", plantType: "flower", targetSecondsSnapshot: 300,
    });
  });

  it("学习与冥想共享全局单 active 约束", async () => {
    const category = (await db.categories.orderBy("sortOrder").first())!;
    const study = new SessionRepository(db, clock, () => `study-${++sequence}`);
    const activeStudy = await study.startStopwatch({
      categoryId: category.id, title: "正在学习", timezone: "Asia/Shanghai",
    });
    await expect(startFree()).rejects.toThrow(/已有进行中的/);
    await study.discard(activeStudy.id);

    const activeMeditation = await startFree();
    await expect(study.startStopwatch({
      categoryId: category.id, title: "再次学习", timezone: "Asia/Shanghai",
    })).rejects.toThrow(/已有进行中的/);
    await expect(startFree()).rejects.toThrow(/已有进行中的/);
    expect((await meditation.getActive())?.id).toBe(activeMeditation.id);
  });

  it("两个数据库连接并发开始时只创建一个全局 active", async () => {
    const secondDb = new StudyFlowDatabase(db.name);
    const second = new MeditationRepository(secondDb, clock, () => `second-${++sequence}`);
    await secondDb.open();
    try {
      const input = {
        mode: "free" as const, targetMinutes: null, intention: "rest" as const,
        intentionNote: "", breathingPattern: "none" as const, timezone: "Asia/Shanghai",
      };
      const results = await Promise.allSettled([meditation.start(input), second.start(input)]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(await db.meditationSessions.where("status").equals("running").count()).toBe(1);
    } finally {
      secondDb.close();
    }
  });

  it("多标签 stale revision 被 CAS 拒绝，并发结束只生成一朵花", async () => {
    const secondDb = new StudyFlowDatabase(db.name);
    const second = new MeditationRepository(secondDb, clock, () => `second-${++sequence}`);
    await secondDb.open();
    try {
      const started = await startFree();
      const stale = (await second.getActive())!;
      const paused = await meditation.pause(started.id, started.revision);
      await expect(second.resume(stale.id, stale.revision)).rejects.toThrow(/其他标签页|更新/);
      const resumed = await meditation.resume(paused.id, paused.revision);
      advance(61_000);
      const results = await Promise.allSettled([
        meditation.finish(resumed.id, {}, resumed.revision),
        second.finish(resumed.id, {}, resumed.revision),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(await db.growthRecords.where("sourceSessionId").equals(resumed.id).count()).toBe(1);
    } finally {
      secondDb.close();
    }
  });
});
