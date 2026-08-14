import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Expected data-layer contract. Concrete filenames may be adapted once the
// implementation lands; behavior and atomicity requirements should not change.
import { StudyFlowDatabase } from '../src/db/database';
import { CategoryRepository } from '../src/db/categoryRepository';
import { TaskRepository } from '../src/db/taskRepository';

describe('IndexedDB repositories', () => {
  let db: StudyFlowDatabase;
  let tasks: TaskRepository;
  let categories: CategoryRepository;

  beforeEach(async () => {
    db = new StudyFlowDatabase(`studyflow-test-${crypto.randomUUID()}`);
    tasks = new TaskRepository(db);
    categories = new CategoryRepository(db);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('首次初始化只创建一次五个默认分类', async () => {
    db.close();
    await db.open();
    expect((await categories.list()).map((item) => item.name)).toEqual(
      expect.arrayContaining(['高数', '线性代数', 'C', 'CS50', '其他']),
    );
    expect(await categories.list()).toHaveLength(5);
  });

  it('完成一次任务 CRUD，并为每个变化记录不可变事件快照', async () => {
    const category = (await categories.list())[0];
    const created = await tasks.create({
      title: '复习矩阵', categoryId: category.id, estimatedMinutes: 45,
      dueDate: '2026-08-14', important: true, urgent: false,
    });
    const updated = await tasks.update(created.id, { title: '复习矩阵乘法', estimatedMinutes: 60 });
    const completed = await tasks.toggleComplete(created.id, true);
    const reopened = await tasks.toggleComplete(created.id, false);
    await tasks.archive(created.id);

    expect(updated.title).toBe('复习矩阵乘法');
    expect(completed.completedAt).not.toBeNull();
    expect(reopened.completedAt).toBeNull();
    expect(await tasks.list()).toEqual([]);

    const events = await db.taskEvents.where('taskId').equals(created.id).toArray();
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['created', 'updated', 'completed', 'reopened', 'archived']),
    );
    expect(events).toHaveLength(5);
    expect(events.find((event) => event.type === 'created')?.snapshot.title).toBe('复习矩阵');
    expect(events.find((event) => event.type === 'completed')?.snapshot.title).toBe('复习矩阵乘法');
  });

  it('归档不会物理删除任务或事件，普通查询不返回归档任务', async () => {
    const category = (await categories.list())[0];
    const created = await tasks.create({
      title: '归档测试', categoryId: category.id, estimatedMinutes: 15,
      dueDate: '2026-08-14', important: false, urgent: false,
    });
    await tasks.archive(created.id);
    expect(await tasks.get(created.id)).toMatchObject({ id: created.id, archivedAt: expect.any(String) });
    expect(await tasks.list()).toEqual([]);
    expect(await db.taskEvents.where('taskId').equals(created.id).count()).toBeGreaterThan(0);
  });

  it('拒绝非法分钟数、空标题和不存在的分类', async () => {
    await expect(tasks.create({
      title: '', categoryId: 'missing', estimatedMinutes: 0, dueDate: 'bad-date',
      important: false, urgent: false,
    })).rejects.toThrow();
    expect(await tasks.list({ includeArchived: true })).toEqual([]);
  });

  it('分类名称忽略大小写去重，禁止删除占用分类及最后一个分类', async () => {
    const all = await categories.list();
    await expect(categories.create({ name: 'cs50' })).rejects.toThrow(/重复|存在/i);

    await tasks.create({
      title: 'C 作业', categoryId: all[2].id, estimatedMinutes: 20,
      dueDate: '2026-08-14', important: false, urgent: true,
    });
    await expect(categories.archive(all[2].id)).rejects.toThrow(/使用|关联|任务/i);
    const cTask = (await tasks.list())[0];
    await tasks.archive(cTask.id);
    for (const category of all.slice(1)) await categories.archive(category.id);
    await expect(categories.archive(all[0].id)).rejects.toThrow(/最后|至少保留/i);
  });

  it('关闭并重新打开同名数据库后任务仍存在', async () => {
    const dbName = db.name;
    const category = (await categories.list())[0];
    const created = await tasks.create({
      title: '持久化测试', categoryId: category.id, estimatedMinutes: 30,
      dueDate: '2026-08-14', important: true, urgent: true,
    });
    db.close();
    const reopenedDb = new StudyFlowDatabase(dbName);
    const reopenedTasks = new TaskRepository(reopenedDb);
    expect((await reopenedTasks.get(created.id)).title).toBe('持久化测试');
    reopenedDb.close();
  });
});
