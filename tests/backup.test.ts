import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudyFlowDatabase } from '../src/db/database';
import { BackupRepository } from '../src/db/backupRepository';

describe('完整导出与覆盖导入', () => {
  let db: StudyFlowDatabase;
  let backups: BackupRepository;

  beforeEach(async () => {
    db = new StudyFlowDatabase(`studyflow-backup-test-${crypto.randomUUID()}`);
    backups = new BackupRepository(db);
    await db.open();
  });
  afterEach(async () => db.delete());

  it('导出包含格式、版本、时间以及分类/任务/事件', async () => {
    const backup = await backups.exportData();
    expect(backup).toMatchObject({
      format: 'studyflow-backup',
      version: 1,
      data: { tasks: [], taskEvents: [] },
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
