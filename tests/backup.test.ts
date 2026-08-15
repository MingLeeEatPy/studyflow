import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudyFlowDatabase } from '../src/db/database';
import { BackupRepository } from '../src/db/backupRepository';
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

  it('V2 导出包含计划数据、执行数据和设置', async () => {
    const backup = await backups.exportData();
    expect(backup).toMatchObject({
      format: 'studyflow-backup',
      version: 2,
      data: {
        tasks: [], taskEvents: [], studySessions: [], studyIntervals: [], sessionRevisions: [],
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
      version: 2,
      data: {
        studySessions: [], studyIntervals: [], sessionRevisions: [],
        executionSettings: { focusMinutes: 25, roundsPerSet: 4 },
      },
    });
  });

  it('兼容缺少音量字段的早期 V2 备份并补齐默认音量', async () => {
    const exported = await backups.exportData();
    const legacySettings: Record<string, unknown> = { ...exported.data.executionSettings };
    delete legacySettings.soundVolume;
    await backups.replaceAll({
      ...exported,
      data: { ...exported.data, executionSettings: legacySettings },
    });
    expect((await backups.exportData()).data.executionSettings.soundVolume).toBe(80);
  });

  it('V2 执行会话和区间可完整导出并覆盖恢复', async () => {
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

    await db.studySessions.clear();
    await db.studyIntervals.clear();
    await backups.replaceAll(exported);
    expect(await db.studySessions.get(started.id)).toMatchObject({ outcome: 'completed' });
    expect(await db.studyIntervals.where('sessionId').equals(started.id).count()).toBe(1);
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
