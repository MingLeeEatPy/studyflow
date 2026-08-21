import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudyFlowDatabase } from '../src/db/database';
import { BackupRepository } from '../src/db/backupRepository';
import { MeditationRepository } from '../src/db/meditationRepository';
import { SessionRepository } from '../src/db/sessionRepository';

describe('完整导出与覆盖导入', () => {
  let db: StudyFlowDatabase;
  let backups: BackupRepository;

  beforeEach(async () => {
    db = new StudyFlowDatabase(`studyflow-backup-test-${crypto.randomUUID()}`);
    backups = new BackupRepository(db);
    await db.open();
  });
  afterEach(async () => db.delete());

  it('V3 导出包含计划、执行、成长、冥想预留数据和设置', async () => {
    const backup = await backups.exportData();
    expect(backup).toMatchObject({
      format: 'studyflow-backup',
      version: 3,
      data: {
        tasks: [], taskEvents: [], studySessions: [], studyIntervals: [], sessionRevisions: [],
        growthRecords: [], meditationSessions: [], meditationIntervals: [],
        executionSettings: { focusMinutes: 25, stopwatchAutoPauseMinutes: 240 },
      },
    });
    expect(backup.data.categories).toHaveLength(5);
  });

  it.each([
    ['缺少格式', {}],
    ['错误格式', { format: 'other', version: 1, data: {} }],
    ['不支持版本', { format: 'studyflow-backup', version: 999, data: {} }],
    ['数据结构错误', { format: 'studyflow-backup', version: 1, data: { categories: [], tasks: 'bad', taskEvents: [] } }],
  ])('无效备份不会修改现有数据库：%s', async (_label, input) => {
    const before = await backups.exportData();
    expect(() => backups.parse(input)).toThrow();
    await expect(backups.replaceAll(input)).rejects.toThrow();
    const after = await backups.exportData();
    expect(after.data).toEqual(before.data);
  });

  it('有效导入在单一事务中完全替换当前数据，且保留历史事件', async () => {
    const categoryId = (await db.categories.toArray())[0].id;
    const backup = {
      format: 'studyflow-backup' as const,
      version: 1 as const,
      exportedAt: '2026-08-14T12:00:00.000Z',
      data: {
        categories: [{ id: 'new-category', name: '物理', sortOrder: 0, archivedAt: null,
          createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z' }],
        tasks: [],
        taskEvents: [],
      },
    };
    expect(categoryId).not.toBe('new-category');
    await backups.replaceAll(backup);
    expect((await db.categories.toArray()).map((item) => item.id)).toEqual(['new-category']);
  });

  it('兼容导入 V1 备份，并自动补齐空执行记录和默认设置', async () => {
    const timestamp = '2026-08-14T00:00:00.000Z';
    await backups.replaceAll({
      format: 'studyflow-backup', version: 1, exportedAt: timestamp,
      data: {
        categories: [{ id: 'legacy-category', name: '旧分类', sortOrder: 0, archivedAt: null,
          createdAt: timestamp, updatedAt: timestamp }],
        tasks: [], taskEvents: [],
      },
    });
    const upgraded = await backups.exportData();
    expect(upgraded).toMatchObject({
      version: 3,
      data: {
        studySessions: [], studyIntervals: [], sessionRevisions: [], growthRecords: [],
        meditationSessions: [], meditationIntervals: [],
        executionSettings: { focusMinutes: 25, roundsPerSet: 4 },
      },
    });
  });

  it('兼容缺少音量字段的早期 V2 备份并补齐默认音量及 V3 空数据', async () => {
    const exported = await backups.exportData();
    const legacySettings: Record<string, unknown> = { ...exported.data.executionSettings };
    delete legacySettings.soundVolume;
    await backups.replaceAll({
      ...exported,
      version: 2,
      data: {
        tasks: exported.data.tasks, categories: exported.data.categories, taskEvents: exported.data.taskEvents,
        studySessions: exported.data.studySessions, studyIntervals: exported.data.studyIntervals,
        sessionRevisions: exported.data.sessionRevisions, executionSettings: legacySettings,
      },
    });
    const upgraded = await backups.exportData();
    expect(upgraded.data.executionSettings.soundVolume).toBe(80);
    expect(upgraded.data.growthRecords).toEqual([]);
  });

  it('V3 执行会话、区间与成长记录可完整导出并覆盖恢复', async () => {
    const category = (await db.categories.orderBy('sortOrder').first())!;
    let now = new Date('2026-08-14T00:00:00.000Z');
    let sequence = 0;
    const sessions = new SessionRepository(db, () => new Date(now), () => `backup-id-${++sequence}`);
    const started = await sessions.startStopwatch({
      categoryId: category.id, title: '备份执行记录', timezone: 'Asia/Shanghai',
    });
    now = new Date('2026-08-14T00:01:01.000Z');
    await sessions.finish(started.id, { outcome: 'completed' }, started.revision);
    const exported = await backups.exportData();
    expect(exported.data.studySessions).toHaveLength(1);
    expect(exported.data.studyIntervals).toHaveLength(1);
    expect(exported.data.growthRecords).toHaveLength(1);

    await db.studySessions.clear();
    await db.studyIntervals.clear();
    await db.growthRecords.clear();
    await backups.replaceAll(exported);
    expect(await db.studySessions.get(started.id)).toMatchObject({ outcome: 'completed' });
    expect(await db.studyIntervals.where('sessionId').equals(started.id).count()).toBe(1);
    expect(await db.growthRecords.where('sourceSessionId').equals(started.id).count()).toBe(1);
  });

  it('导出运行中的冥想前自动暂停，并保存暂停边界', async () => {
    const meditation = new MeditationRepository(db);
    const started = await meditation.start({
      mode: 'free', targetMinutes: null, intention: 'calm', intentionNote: '',
      breathingPattern: 'none', timezone: 'Asia/Shanghai',
    });
    const exported = await backups.exportData();
    expect(exported.data.meditationSessions).toMatchObject([{
      id: started.id, status: 'paused', revision: 1,
    }]);
    expect(exported.data.meditationIntervals).toMatchObject([{
      sessionId: started.id, kind: 'meditation', pauses: [{ startedAt: expect.any(String), endedAt: null }],
    }]);
    expect(await db.meditationSessions.get(started.id)).toMatchObject({ status: 'paused', revision: 1 });
  });

  it('V3 冥想 session、interval 和成长花朵可完整恢复', async () => {
    let now = new Date('2026-08-14T00:00:00.000Z');
    let sequence = 0;
    const meditation = new MeditationRepository(db, () => new Date(now), () => `backup-meditation-${++sequence}`);
    const started = await meditation.start({
      mode: 'timed', targetMinutes: 5, intention: 'self-care', intentionNote: '照顾自己',
      breathingPattern: 'none', timezone: 'Asia/Shanghai',
    });
    now = new Date('2026-08-14T00:01:01.000Z');
    await meditation.finish(started.id, { feeling: 5, note: '轻松一些' }, started.revision);
    const exported = await backups.exportData();

    await db.meditationSessions.clear();
    await db.meditationIntervals.clear();
    await db.growthRecords.clear();
    await backups.replaceAll(exported);
    expect(await db.meditationSessions.get(started.id)).toMatchObject({
      status: 'finished', feeling: 5, note: '轻松一些',
    });
    expect(await db.meditationIntervals.where('sessionId').equals(started.id).count()).toBe(1);
    expect(await db.growthRecords.where('sourceSessionId').equals(started.id).first()).toMatchObject({
      sourceType: 'meditation', plantType: 'flower', targetSecondsSnapshot: 300,
    });
  });

  it('拒绝破坏成长领域不变量的 V3 备份，且不改变当前数据', async () => {
    const category = (await db.categories.orderBy('sortOrder').first())!;
    let now = new Date('2026-08-14T00:00:00.000Z');
    const sessions = new SessionRepository(db, () => new Date(now), (() => { let sequence = 0; return () => `growth-check-${++sequence}`; })());
    const started = await sessions.startStopwatch({ categoryId: category.id, title: '合法成长来源', timezone: 'Asia/Shanghai' });
    now = new Date('2026-08-14T00:01:01.000Z');
    await sessions.finish(started.id, { outcome: 'completed' }, started.revision);
    const valid = await backups.exportData();

    const candidates = [
      (() => { const value = structuredClone(valid); value.data.studySessions[0].status = 'paused'; value.data.studySessions[0].endedAt = null; return value; })(),
      (() => { const value = structuredClone(valid); value.data.studyIntervals[0].endedAt = '2026-08-14T00:00:30.000Z'; return value; })(),
      (() => { const value = structuredClone(valid); value.data.growthRecords[0].plantType = 'flower'; return value; })(),
      (() => { const value = structuredClone(valid); value.data.growthRecords[0].variant = ((value.data.growthRecords[0].variant + 1) % 3) as 0 | 1 | 2; return value; })(),
      (() => { const value = structuredClone(valid); value.data.growthRecords[0].targetSecondsSnapshot += 60; return value; })(),
      (() => { const value = structuredClone(valid); value.data.growthRecords[0].timezone = 'UTC'; return value; })(),
      (() => { const value = structuredClone(valid); value.data.growthRecords[0].localDate = '2026-08-15'; return value; })(),
      (() => { const value = structuredClone(valid); value.data.growthRecords[0].createdAt = '2026-08-14T00:01:00.000Z'; return value; })(),
      (() => { const value = structuredClone(valid); value.data.growthRecords.push({ ...value.data.growthRecords[0], id: 'duplicate-growth' }); return value; })(),
      (() => {
        const value = structuredClone(valid);
        const originalInterval = structuredClone(value.data.studyIntervals[0]);
        value.data.studyIntervals[0].endedAt = '2026-08-14T00:00:30.000Z';
        value.data.sessionRevisions.push({
          id: 'forged-revision', sessionId: value.data.studySessions[0].id, reason: '无关审计记录',
          before: { session: { ...value.data.studySessions[0], id: 'unrelated-session', revision: 0 }, intervals: [originalInterval] },
          after: { session: value.data.studySessions[0], intervals: value.data.studyIntervals },
          createdAt: '2026-08-14T00:01:01.000Z',
        });
        return value;
      })(),
    ];
    for (const candidate of candidates) {
      await expect(backups.replaceAll(candidate)).rejects.toThrow(/成长|会话/);
      expect((await backups.exportData()).data).toEqual(valid.data);
    }
  });

  it('历史修正到一分钟以下后，审计记录仍能证明植物来源并允许恢复备份', async () => {
    const category = (await db.categories.orderBy('sortOrder').first())!;
    let now = new Date('2026-08-14T00:00:00.000Z');
    let sequence = 0;
    const sessions = new SessionRepository(db, () => new Date(now), () => `revision-growth-${++sequence}`);
    const started = await sessions.startStopwatch({ categoryId: category.id, title: '修正后的幼苗', timezone: 'Asia/Shanghai' });
    now = new Date('2026-08-14T00:01:01.000Z');
    const finished = (await sessions.finish(started.id, { outcome: 'completed' }, started.revision))!;
    const shortened = (await sessions.listIntervals(finished.id)).map((interval) => ({
      ...interval, endedAt: '2026-08-14T00:00:30.000Z', updatedAt: '2026-08-14T00:00:30.000Z',
    }));
    await sessions.correct(finished.id, { intervals: shortened, reason: '修正误记时间' }, finished.revision);
    const exported = await backups.exportData();
    await backups.replaceAll(exported);
    expect(await db.growthRecords.where('sourceSessionId').equals(finished.id).count()).toBe(1);
    expect(await db.sessionRevisions.where('sessionId').equals(finished.id).count()).toBe(1);
  });

  it('导出运行中的会话前自动暂停，并把暂停状态写入备份和数据库', async () => {
    const category = (await db.categories.orderBy('sortOrder').first())!;
    const sessions = new SessionRepository(db, () => new Date('2026-08-14T00:05:00.000Z'));
    const started = await sessions.startStopwatch({
      categoryId: category.id, title: '导出时暂停', timezone: 'Asia/Shanghai',
    });
    const exported = await backups.exportData();
    expect(exported.data.studySessions[0]).toMatchObject({ id: started.id, status: 'paused', revision: 1 });
    expect(await db.studySessions.get(started.id)).toMatchObject({ status: 'paused', revision: 1 });
    expect(exported.data.studyIntervals[0].pauses).toHaveLength(1);
  });

  it('任何写入失败都回滚，避免只导入一部分表', async () => {
    const before = await backups.exportData();
    const originalCategory = before.data.categories[0];
    const invalidCrossReference = {
      format: 'studyflow-backup', version: 1, exportedAt: new Date().toISOString(),
      data: {
        categories: before.data.categories,
        tasks: [{
          id: 'task-x', title: '非法引用', categoryId: 'missing', estimatedMinutes: 30,
          dueDate: '2026-08-14', important: false, urgent: false, completed: false,
          completedAt: null, archivedAt: null, createdAt: originalCategory.createdAt,
          updatedAt: originalCategory.updatedAt,
        }],
        taskEvents: [],
      },
    };
    await expect(backups.replaceAll(invalidCrossReference)).rejects.toThrow(/分类/);
    expect((await backups.exportData()).data).toEqual(before.data);
  });
});
