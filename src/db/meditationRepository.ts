import {
  finishMeditationInputSchema,
  meditationIntervalSchema,
  meditationSessionSchema,
  startMeditationInputSchema,
  type FinishMeditationInput,
  type MeditationInterval,
  type MeditationSession,
  type StartMeditationInput,
} from "../../shared/schemas/models";
import { createMeditationGrowthRecord } from "../domain/growth";
import { breathingGuide, totalMeditationMs } from "../domain/meditation";
import { ConflictError, NotFoundError } from "./errors";
import { db, type StudyFlowDatabase } from "./database";

export interface MeditationSleepGapResolution {
  intervalId: string;
  gapIndex: number;
  resolution: "include" | "exclude" | "correct";
  correctedSeconds?: number;
}

export class MeditationRepository {
  constructor(
    private readonly database: StudyFlowDatabase = db,
    private readonly clock: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async start(input: StartMeditationInput): Promise<MeditationSession> {
    const value = startMeditationInputSchema.parse(input);
    return this.database.transaction("rw", [this.database.meditationSessions, this.database.meditationIntervals, this.database.studySessions], async () => {
      const activeStudy = await this.database.studySessions.where("status").anyOf("running", "paused", "awaiting-confirmation", "sleep-review").first();
      const activeMeditation = await this.database.meditationSessions.where("status").anyOf("breathing", "running", "paused", "sleep-review").first();
      if (activeStudy || activeMeditation) throw new ConflictError("已有进行中的学习或冥想会话");
      const now = this.clock().toISOString();
      const guide = breathingGuide(value.breathingPattern);
      const sessionId = this.createId();
      const interval = meditationIntervalSchema.parse({
        id: this.createId(), sessionId, kind: guide ? "breathing" : "meditation",
        targetSeconds: guide?.totalSeconds ?? (value.targetMinutes ? value.targetMinutes * 60 : null),
        startedAt: now, endedAt: null, pauses: [], sleepGaps: [], createdAt: now, updatedAt: now,
      });
      const session = meditationSessionSchema.parse({
        id: sessionId, mode: value.mode, status: guide ? "breathing" : "running",
        intention: value.intention, intentionNote: value.intentionNote, breathingPattern: value.breathingPattern,
        breathingRounds: guide?.rounds ?? 0, targetSeconds: value.targetMinutes ? value.targetMinutes * 60 : null,
        activeIntervalId: interval.id, startedAt: now, meditationStartedAt: guide ? null : now,
        endedAt: null, timezone: value.timezone, feeling: null, note: "", revision: 0,
        createdAt: now, updatedAt: now,
      });
      await this.database.meditationSessions.add(session);
      await this.database.meditationIntervals.add(interval);
      return session;
    });
  }

  async beginOrSkipBreathing(id: string, expectedRevision?: number): Promise<MeditationSession> {
    return this.database.transaction("rw", this.database.meditationSessions, this.database.meditationIntervals, async () => {
      const session = await this.requireSession(id); this.checkRevision(session, expectedRevision);
      if (session.status !== "breathing") throw new ConflictError("当前不在呼吸引导阶段");
      const current = await this.requireInterval(session.activeIntervalId);
      if (current.kind !== "breathing") throw new ConflictError("呼吸引导阶段记录不一致");
      const now = this.clock().toISOString();
      current.endedAt = now; current.updatedAt = now;
      const interval = meditationIntervalSchema.parse({
        id: this.createId(), sessionId: id, kind: "meditation", targetSeconds: session.targetSeconds,
        startedAt: now, endedAt: null, pauses: [], sleepGaps: [], createdAt: now, updatedAt: now,
      });
      const updated = meditationSessionSchema.parse({ ...session, status: "running", activeIntervalId: interval.id,
        meditationStartedAt: now, revision: session.revision + 1, updatedAt: now });
      await this.database.meditationIntervals.put(meditationIntervalSchema.parse(current));
      await this.database.meditationIntervals.add(interval);
      await this.database.meditationSessions.put(updated);
      return updated;
    });
  }

  async pause(id: string, expectedRevision?: number): Promise<MeditationSession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.status !== "running" || interval.kind !== "meditation") throw new ConflictError("当前冥想不能暂停");
      interval.pauses.push({ startedAt: now, endedAt: null }); interval.updatedAt = now;
      await this.database.meditationIntervals.put(meditationIntervalSchema.parse(interval));
      return { ...session, status: "paused" };
    });
  }

  async resume(id: string, expectedRevision?: number): Promise<MeditationSession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.status !== "paused" || interval.kind !== "meditation") throw new ConflictError("当前冥想不能恢复");
      const pause = interval.pauses.at(-1);
      if (!pause || pause.endedAt) throw new ConflictError("暂停记录不完整");
      pause.endedAt = now; interval.updatedAt = now;
      await this.database.meditationIntervals.put(meditationIntervalSchema.parse(interval));
      return { ...session, status: "running" };
    });
  }

  async reportSleepGap(id: string, from: string, to: string, expectedRevision?: number): Promise<MeditationSession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.status !== "running" || interval.kind !== "meditation") throw new ConflictError("当前阶段不能处理休眠间隔");
      interval.sleepGaps.push({ detectedAt: now, from, to, resolution: null, correctedSeconds: null, resumeStatus: "running" });
      interval.updatedAt = now; await this.database.meditationIntervals.put(meditationIntervalSchema.parse(interval));
      return { ...session, status: "sleep-review" };
    });
  }

  async resolveSleepGap(id: string, input: MeditationSleepGapResolution, expectedRevision?: number): Promise<MeditationSession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.status !== "sleep-review" || interval.id !== input.intervalId) throw new ConflictError("休眠区间不属于当前冥想");
      const gap = interval.sleepGaps[input.gapIndex];
      if (!gap || gap.resolution) throw new ConflictError("休眠区间不存在或已处理");
      gap.resolution = input.resolution;
      gap.correctedSeconds = input.resolution === "correct" ? Math.max(0, Math.floor(input.correctedSeconds ?? 0)) : null;
      interval.updatedAt = now; await this.database.meditationIntervals.put(meditationIntervalSchema.parse(interval));
      return { ...session, status: gap.resumeStatus === "paused" ? "paused" : "running" };
    });
  }

  async finish(id: string, input: FinishMeditationInput, expectedRevision?: number): Promise<MeditationSession | null> {
    const value = finishMeditationInputSchema.parse(input);
    const now = this.clock().toISOString();
    return this.database.transaction("rw", this.database.meditationSessions, this.database.meditationIntervals, this.database.growthRecords, async () => {
      const session = await this.requireSession(id); this.checkRevision(session, expectedRevision);
      if (session.status === "finished") throw new ConflictError("冥想已经结束");
      const intervals = await this.listIntervals(id);
      if (session.status === "sleep-review" || intervals.some((interval) => interval.sleepGaps.some((gap) => gap.resolution === null))) {
        throw new ConflictError("请先处理检测到的休眠时间，再结束冥想");
      }
      const current = intervals.find((interval) => interval.id === session.activeIntervalId);
      if (current && !current.endedAt) {
        current.endedAt = now; current.updatedAt = now;
        const pause = current.pauses.at(-1); if (pause && !pause.endedAt) pause.endedAt = now;
      }
      const effective = totalMeditationMs(current ? intervals.map((interval) => interval.id === current.id ? current : interval) : intervals, now);
      if (effective < 60_000) {
        await this.database.meditationIntervals.where("sessionId").equals(id).delete();
        await this.database.meditationSessions.delete(id);
        return null;
      }
      const finished = meditationSessionSchema.parse({ ...session, status: "finished", activeIntervalId: null,
        endedAt: now, feeling: value.feeling, note: value.note, revision: session.revision + 1, updatedAt: now });
      if (current) await this.database.meditationIntervals.put(meditationIntervalSchema.parse(current));
      await this.database.meditationSessions.put(finished);
      await this.database.growthRecords.add(createMeditationGrowthRecord(finished, this.createId(), now));
      return finished;
    });
  }

  async discard(id: string): Promise<void> {
    await this.database.transaction("rw", this.database.meditationSessions, this.database.meditationIntervals, this.database.growthRecords, async () => {
      const session = await this.requireSession(id);
      if (session.status === "finished") throw new ConflictError("已结束的冥想记录不能无痕删除");
      await this.database.meditationIntervals.where("sessionId").equals(id).delete();
      await this.database.growthRecords.where("sourceSessionId").equals(id).delete();
      await this.database.meditationSessions.delete(id);
    });
  }

  async getActive(): Promise<MeditationSession | undefined> {
    return this.database.meditationSessions.where("status").anyOf("breathing", "running", "paused", "sleep-review").first();
  }

  async listHistory(): Promise<MeditationSession[]> {
    return (await this.database.meditationSessions.where("status").equals("finished").toArray())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async listIntervals(sessionId: string): Promise<MeditationInterval[]> {
    return this.database.meditationIntervals.where("sessionId").equals(sessionId).sortBy("startedAt");
  }

  private async mutateActive(id: string, expectedRevision: number | undefined, mutation: (session: MeditationSession, interval: MeditationInterval, now: string) => Promise<MeditationSession>): Promise<MeditationSession> {
    return this.database.transaction("rw", this.database.meditationSessions, this.database.meditationIntervals, async () => {
      const session = await this.requireSession(id); this.checkRevision(session, expectedRevision);
      if (session.status === "finished") throw new ConflictError("冥想已经结束");
      const interval = await this.requireInterval(session.activeIntervalId); const now = this.clock().toISOString();
      const changed = await mutation(session, interval, now);
      const updated = meditationSessionSchema.parse({ ...changed, revision: session.revision + 1, updatedAt: now });
      await this.database.meditationSessions.put(updated); return updated;
    });
  }

  private async requireSession(id: string): Promise<MeditationSession> {
    const value = await this.database.meditationSessions.get(id); if (!value) throw new NotFoundError("冥想会话"); return value;
  }
  private async requireInterval(id: string | null): Promise<MeditationInterval> {
    if (!id) throw new ConflictError("当前冥想阶段不存在");
    const value = await this.database.meditationIntervals.get(id); if (!value) throw new NotFoundError("冥想阶段"); return value;
  }
  private checkRevision(session: MeditationSession, expected?: number): void {
    if (expected !== undefined && session.revision !== expected) throw new ConflictError("冥想已在其他标签页更新");
  }
}

export const meditationRepository = new MeditationRepository();
