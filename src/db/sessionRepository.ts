import {
  finishSessionInputSchema, pomodoroSettingsSnapshotSchema, startSessionInputSchema, studyIntervalSchema, studySessionSchema,
  type FinishSessionInput, type PomodoroSettingsSnapshot, type SessionOutcome, type StartSessionInput, type StudyInterval, type StudySession,
} from "../../shared/schemas/models";
import { hasUnresolvedSleepGap, totalFocusMs } from "../domain/execution";
import { ConflictError, NotFoundError } from "./errors";
import { db, type StudyFlowDatabase } from "./database";
import { taskRepository, TaskRepository } from "./taskRepository";

export type PomodoroAdvanceAction = "start-break" | "skip-break" | "start-focus";
export interface HistoryFilter { from?: string; to?: string; categoryId?: string; taskId?: string; outcome?: SessionOutcome }
export interface SleepGapResolution { intervalId: string; gapIndex: number; resolution: "include" | "exclude" | "correct"; correctedSeconds?: number }
export interface SessionCorrection { session?: Partial<Pick<StudySession, "outcome" | "failureReason" | "note" | "summary">>; intervals?: StudyInterval[]; reason: string }

export class SessionRepository {
  constructor(
    private readonly database: StudyFlowDatabase = db,
    private readonly clock: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly tasks: TaskRepository = taskRepository,
  ) {}

  startStopwatch(input: StartSessionInput): Promise<StudySession> { return this.start(input, "stopwatch"); }
  startPomodoro(input: StartSessionInput): Promise<StudySession> { return this.start(input, "pomodoro"); }

  private async start(input: StartSessionInput, mode: "stopwatch" | "pomodoro"): Promise<StudySession> {
    const value = startSessionInputSchema.parse(input);
    return this.database.transaction("rw", this.database.studySessions, this.database.studyIntervals, this.database.tasks, this.database.categories, this.database.executionSettings, async () => {
      if (await this.database.studySessions.where("status").anyOf("running", "paused", "awaiting-confirmation", "sleep-review").first()) {
        throw new ConflictError("已有进行中的学习会话");
      }
      const category = await this.database.categories.get(value.categoryId);
      if (!category || category.archivedAt) throw new NotFoundError("分类");
      const task = value.taskId ? await this.database.tasks.get(value.taskId) : undefined;
      if (value.taskId && (!task || task.archivedAt)) throw new NotFoundError("任务");
      if (task && task.categoryId !== value.categoryId) throw new ConflictError("任务与分类不匹配");
      if (!task && !value.title) throw new ConflictError("临时学习记录必须填写标题");
      const now = this.clock().toISOString();
      const settings = await this.database.executionSettings.get("default");
      const pomodoroSettings = mode === "pomodoro" ? pomodoroSettingsSnapshotSchema.parse(value.pomodoroSettings ?? {
        focusMinutes: settings?.focusMinutes ?? 25, shortBreakMinutes: settings?.shortBreakMinutes ?? 5,
        longBreakMinutes: settings?.longBreakMinutes ?? 15, roundsPerSet: settings?.roundsPerSet ?? 4,
      }) : null;
      const sessionId = this.createId();
      const interval = studyIntervalSchema.parse({
        id: this.createId(), sessionId, kind: "focus", pomodoroRound: mode === "pomodoro" ? 1 : null,
        targetSeconds: pomodoroSettings ? pomodoroSettings.focusMinutes * 60 : null,
        startedAt: now, endedAt: null, pauses: [], sleepGaps: [], createdAt: now, updatedAt: now,
      });
      const session = studySessionSchema.parse({
        id: sessionId, taskId: task?.id ?? null, categoryId: category.id,
        taskTitleSnapshot: task?.title ?? value.title, categoryNameSnapshot: category.name,
        estimatedMinutesSnapshot: task?.estimatedMinutes ?? null, goal: value.goal,
        mode, pomodoroSettingsSnapshot: pomodoroSettings, status: "running", activeIntervalId: interval.id, pomodoroRound: 1,
        startedAt: now, endedAt: null, timezone: value.timezone, outcome: null,
        failureReason: null, note: "", summary: "", revision: 0, createdAt: now, updatedAt: now,
      });
      await this.database.studySessions.add(session);
      await this.database.studyIntervals.add(interval);
      return session;
    });
  }

  async getActive(): Promise<StudySession | undefined> {
    return this.database.studySessions.where("status").anyOf("running", "paused", "awaiting-confirmation", "sleep-review").first();
  }

  async listIntervals(sessionId: string): Promise<StudyInterval[]> {
    return this.database.studyIntervals.where("sessionId").equals(sessionId).sortBy("startedAt");
  }

  async updatePomodoroSettings(id: string, input: PomodoroSettingsSnapshot, expectedRevision?: number): Promise<StudySession> {
    const settings = pomodoroSettingsSnapshotSchema.parse(input);
    return this.database.transaction("rw", this.database.studySessions, async () => {
      const session = await this.requireSession(id);
      this.checkRevision(session, expectedRevision);
      if (session.status === "finished") throw new ConflictError("已结束的会话不能修改番茄设置");
      if (session.mode !== "pomodoro") throw new ConflictError("当前会话不是番茄钟");
      const now = this.clock().toISOString();
      const updated = studySessionSchema.parse({
        ...session, pomodoroSettingsSnapshot: settings, revision: session.revision + 1, updatedAt: now,
      });
      await this.database.studySessions.put(updated);
      return updated;
    });
  }

  async pause(id: string, expectedRevision?: number): Promise<StudySession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.status !== "running") throw new ConflictError("只有运行中的会话可以暂停");
      interval.pauses.push({ startedAt: now, endedAt: null });
      interval.updatedAt = now;
      await this.database.studyIntervals.put(studyIntervalSchema.parse(interval));
      return { ...session, status: "paused" };
    });
  }

  async resume(id: string, expectedRevision?: number): Promise<StudySession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.status !== "paused") throw new ConflictError("只有暂停中的会话可以恢复");
      const pause = interval.pauses.at(-1);
      if (!pause || pause.endedAt) throw new ConflictError("暂停记录不完整");
      pause.endedAt = now; interval.updatedAt = now;
      await this.database.studyIntervals.put(studyIntervalSchema.parse(interval));
      return { ...session, status: "running" };
    });
  }

  async advancePomodoro(id: string, action: PomodoroAdvanceAction, expectedRevision?: number): Promise<StudySession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.mode !== "pomodoro") throw new ConflictError("当前会话不是番茄钟");
      const settings = session.pomodoroSettingsSnapshot;
      if (!settings) throw new ConflictError("番茄设置快照不存在");
      if (session.status === "running" && interval.kind === "break" && action === "skip-break") {
        interval.endedAt = now; interval.updatedAt = now;
        await this.database.studyIntervals.put(studyIntervalSchema.parse(interval));
        const round = session.pomodoroRound + 1;
        const next = studyIntervalSchema.parse({ id: this.createId(), sessionId: id, kind: "focus", pomodoroRound: round,
          targetSeconds: settings.focusMinutes * 60, startedAt: now, endedAt: null, pauses: [], sleepGaps: [], createdAt: now, updatedAt: now });
        await this.database.studyIntervals.add(next);
        return { ...session, status: "running", activeIntervalId: next.id, pomodoroRound: round };
      }
      if (session.status !== "awaiting-confirmation") throw new ConflictError("当前番茄阶段尚未等待确认");
      let kind: "focus" | "break";
      let round = session.pomodoroRound;
      if (interval.kind === "focus") {
        if (action !== "start-break" && action !== "skip-break") throw new ConflictError("专注结束后必须开始或跳过休息");
        kind = action === "start-break" ? "break" : "focus";
        if (action === "skip-break") round += 1;
      } else {
        if (action !== "start-focus") throw new ConflictError("休息结束后只能开始下一轮专注");
        kind = "focus"; round += 1;
      }
      const longBreak = round % settings.roundsPerSet === 0;
      const targetSeconds = kind === "focus" ? settings.focusMinutes * 60
        : (longBreak ? settings.longBreakMinutes : settings.shortBreakMinutes) * 60;
      const next = studyIntervalSchema.parse({ id: this.createId(), sessionId: id, kind, pomodoroRound: round,
        targetSeconds, startedAt: now, endedAt: null, pauses: [], sleepGaps: [], createdAt: now, updatedAt: now });
      await this.database.studyIntervals.add(next);
      return { ...session, status: "running", activeIntervalId: next.id, pomodoroRound: round };
    });
  }

  async completeCurrentStage(id: string, expectedRevision?: number): Promise<StudySession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (session.mode !== "pomodoro" || session.status !== "running") throw new ConflictError("当前阶段不能结束");
      interval.endedAt = now; interval.updatedAt = now;
      await this.database.studyIntervals.put(studyIntervalSchema.parse(interval));
      return { ...session, status: "awaiting-confirmation", activeIntervalId: interval.id };
    });
  }

  async reportSleepGap(id: string, from: string, to: string, expectedRevision?: number): Promise<StudySession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      interval.sleepGaps.push({ detectedAt: now, from, to, resolution: null, correctedSeconds: null,
        resumeStatus: session.status === "paused" ? "paused" : "running" });
      interval.updatedAt = now; await this.database.studyIntervals.put(studyIntervalSchema.parse(interval));
      return { ...session, status: "sleep-review" };
    });
  }

  async resolveSleepGap(id: string, input: SleepGapResolution, expectedRevision?: number): Promise<StudySession> {
    return this.mutateActive(id, expectedRevision, async (session, interval, now) => {
      if (interval.id !== input.intervalId) throw new ConflictError("休眠区间不属于当前计时阶段");
      const gap = interval.sleepGaps[input.gapIndex];
      if (!gap || gap.resolution) throw new ConflictError("休眠区间不存在或已处理");
      gap.resolution = input.resolution; gap.correctedSeconds = input.resolution === "correct" ? Math.max(0, Math.floor(input.correctedSeconds ?? 0)) : null;
      interval.updatedAt = now; await this.database.studyIntervals.put(studyIntervalSchema.parse(interval));
      return { ...session, status: gap.resumeStatus };
    });
  }

  async autoPauseIfNeeded(id: string, expectedRevision?: number): Promise<StudySession> {
    const settings = await this.database.executionSettings.get("default");
    const session = await this.requireSession(id);
    const continuouslyRunningMs = this.clock().getTime() - Date.parse(session.updatedAt);
    if (session.mode !== "stopwatch" || session.status !== "running" || continuouslyRunningMs < (settings?.stopwatchAutoPauseMinutes ?? 240) * 60_000) return session;
    return this.pause(id, expectedRevision);
  }

  async finish(id: string, input: FinishSessionInput, expectedRevision?: number): Promise<StudySession | null> {
    const value = finishSessionInputSchema.parse(input);
    const now = this.clock().toISOString();
    return this.database.transaction("rw", this.database.studySessions, this.database.studyIntervals, this.database.tasks, this.database.taskEvents, async () => {
      const session = await this.requireSession(id);
      this.checkRevision(session, expectedRevision);
      if (session.status === "finished") throw new ConflictError("会话已结束");
      const intervals = await this.database.studyIntervals.where("sessionId").equals(id).toArray();
      if (session.status === "sleep-review" || hasUnresolvedSleepGap(intervals)) {
        throw new ConflictError("请先处理检测到的休眠时间，再结束学习");
      }
      const current = intervals.find((item) => item.id === session.activeIntervalId);
      if (current && !current.endedAt) {
        current.endedAt = now;
        const pause = current.pauses.at(-1);
        if (pause && !pause.endedAt) pause.endedAt = now;
        current.updatedAt = now;
      }
      const effective = totalFocusMs(current ? intervals.map((item) => item.id === current.id ? current : item) : intervals, now);
      if (effective < 60_000) {
        await this.database.studyIntervals.where("sessionId").equals(id).delete();
        await this.database.studySessions.delete(id);
        return null;
      }
      const finished = studySessionSchema.parse({ ...session, status: "finished", activeIntervalId: null, endedAt: now,
        outcome: value.outcome, failureReason: value.failureReason, note: value.note, summary: value.summary,
        revision: session.revision + 1, updatedAt: now });
      if (current) await this.database.studyIntervals.put(studyIntervalSchema.parse(current));
      await this.database.studySessions.put(finished);
      if (value.completeTask && value.outcome === "completed" && session.taskId) {
        await this.tasks.toggleComplete(session.taskId, true);
      }
      return finished;
    });
  }

  async discard(id: string): Promise<void> {
    await this.database.transaction("rw", this.database.studySessions, this.database.studyIntervals, async () => {
      await this.database.studyIntervals.where("sessionId").equals(id).delete();
      await this.database.studySessions.delete(id);
    });
  }

  async listHistory(filter: HistoryFilter = {}): Promise<StudySession[]> {
    const rows = await this.database.studySessions.where("status").equals("finished").toArray();
    return rows.filter((s) => (!filter.from || s.startedAt >= filter.from) && (!filter.to || s.startedAt <= filter.to)
      && (!filter.categoryId || s.categoryId === filter.categoryId) && (!filter.taskId || s.taskId === filter.taskId)
      && (!filter.outcome || s.outcome === filter.outcome)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async correct(id: string, correction: SessionCorrection, expectedRevision?: number): Promise<StudySession> {
    if (!correction.reason.trim()) throw new ConflictError("修正必须填写原因");
    return this.database.transaction("rw", this.database.studySessions, this.database.studyIntervals, this.database.sessionRevisions, async () => {
      const current = await this.requireSession(id);
      this.checkRevision(current, expectedRevision);
      if (current.status !== "finished") throw new ConflictError("只能修正已结束会话");
      const now = this.clock().toISOString();
      const updated = studySessionSchema.parse({ ...current, ...correction.session, revision: current.revision + 1, updatedAt: now });
      const beforeIntervals = await this.database.studyIntervals.where("sessionId").equals(id).toArray();
      const afterIntervals = correction.intervals?.map((interval) => studyIntervalSchema.parse(interval)) ?? beforeIntervals;
      if (correction.intervals) {
        this.validateCorrectedTimeline(id, beforeIntervals, afterIntervals);
        await this.database.studyIntervals.where("sessionId").equals(id).delete();
        await this.database.studyIntervals.bulkAdd(afterIntervals);
      }
      await this.database.studySessions.put(updated);
      await this.database.sessionRevisions.add({ id: this.createId(), sessionId: id, reason: correction.reason.trim(),
        before: { session: current, intervals: beforeIntervals }, after: { session: updated, intervals: afterIntervals }, createdAt: now });
      return updated;
    });
  }

  private validateCorrectedTimeline(id: string, before: StudyInterval[], after: StudyInterval[]): void {
    if (after.length !== before.length || new Set(after.map((interval) => interval.id)).size !== after.length
      || before.some((interval) => !after.some((candidate) => candidate.id === interval.id))) {
      throw new ConflictError("修正只能调整现有阶段，不能新增或删除阶段");
    }
    const ordered = [...after].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    ordered.forEach((interval, index) => {
      if (interval.sessionId !== id) throw new ConflictError("修正区间不属于当前会话");
      if (!interval.endedAt) throw new ConflictError("已结束会话的每个阶段都必须有结束时间");
      if (interval.sleepGaps.some((gap) => gap.resolution === null)) throw new ConflictError("修正时间线不能包含未处理的休眠区间");
      const previous = ordered[index - 1];
      if (previous?.endedAt && Date.parse(previous.endedAt) > Date.parse(interval.startedAt)) {
        throw new ConflictError("学习阶段之间不能重叠");
      }
    });
  }

  private async mutateActive(id: string, expectedRevision: number | undefined, mutation: (s: StudySession, i: StudyInterval, now: string) => Promise<StudySession>): Promise<StudySession> {
    return this.database.transaction("rw", this.database.studySessions, this.database.studyIntervals, this.database.executionSettings, async () => {
      const session = await this.requireSession(id); this.checkRevision(session, expectedRevision);
      if (session.status === "finished") throw new ConflictError("会话已结束");
      const interval = await this.requireInterval(session.activeIntervalId); const now = this.clock().toISOString();
      const changed = await mutation(session, interval, now);
      const updated = studySessionSchema.parse({ ...changed, revision: session.revision + 1, updatedAt: now });
      await this.database.studySessions.put(updated); return updated;
    });
  }
  private async requireSession(id: string) { const value = await this.database.studySessions.get(id); if (!value) throw new NotFoundError("学习会话"); return value; }
  private async requireInterval(id: string | null) { if (!id) throw new ConflictError("当前计时阶段不存在"); const value = await this.database.studyIntervals.get(id); if (!value) throw new NotFoundError("计时阶段"); return value; }
  private checkRevision(session: StudySession, expected?: number) { if (expected !== undefined && session.revision !== expected) throw new ConflictError("会话已在其他标签页更新"); }
}

export const sessionRepository = new SessionRepository();
