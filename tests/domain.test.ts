import { describe, expect, it } from 'vitest';

// Contract expected from the application domain layer. The main implementation
// may adapt these import paths, but should preserve the observable behavior.
import {
  calculateTodayStats,
  getTaskQuadrant,
  selectTodayTasks,
  toLocalDate,
} from '../src/domain';
import type { Task } from '../src/domain/models';

const NOW = new Date('2026-08-14T12:00:00+08:00');

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: '学习任务',
    categoryId: 'category-math',
    estimatedMinutes: 60,
    dueDate: '2026-08-14',
    important: false,
    urgent: false,
    completed: false,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-08-10T04:00:00.000Z',
    updatedAt: '2026-08-10T04:00:00.000Z',
    ...overrides,
  };
}

describe('艾森豪威尔四象限', () => {
  it.each([
    [true, true, 'important-urgent'],
    [true, false, 'important-not-urgent'],
    [false, true, 'not-important-urgent'],
    [false, false, 'not-important-not-urgent'],
  ] as const)('important=%s urgent=%s => %s', (important, urgent, expected) => {
    expect(getTaskQuadrant({ important, urgent })).toBe(expected);
  });
});

describe('Today 本地日期规则', () => {
  it('包含今天和逾期的未完成任务，排除未来任务与归档任务', () => {
    const overdue = task({ id: 'overdue', dueDate: '2026-08-13' });
    const today = task({ id: 'today' });
    const future = task({ id: 'future', dueDate: '2026-08-15' });
    const archived = task({ id: 'archived', archivedAt: '2026-08-14T01:00:00.000Z' });

    expect(selectTodayTasks([overdue, today, future, archived], NOW).map((item) => item.id))
      .toEqual(['overdue', 'today']);
  });

  it('保留今天完成且截止日期不晚于今天的任务', () => {
    const completedToday = task({
      id: 'completed-today',
      completed: true,
      completedAt: '2026-08-14T02:00:00.000Z', // 上海 10:00
    });
    const completedYesterday = task({
      id: 'completed-yesterday',
      completed: true,
      completedAt: '2026-08-13T14:00:00.000Z', // 上海 22:00
    });
    const futureCompletedToday = task({
      id: 'future-completed',
      dueDate: '2026-08-15',
      completed: true,
      completedAt: '2026-08-14T02:00:00.000Z',
    });

    expect(selectTodayTasks([completedToday, completedYesterday, futureCompletedToday], NOW)
      .map((item) => item.id)).toEqual(['completed-today']);
  });

  it('跨午夜后，前一天完成的任务自动移出 Today', () => {
    const completed = task({
      completed: true,
      completedAt: '2026-08-14T15:59:00.000Z', // 上海 23:59
    });
    const nextDay = new Date('2026-08-15T00:01:00+08:00');
    expect(selectTodayTasks([completed], nextDay)).toEqual([]);
  });

  it('日期键使用浏览器本地时区，而不是 UTC 日期切片', () => {
    const nearMidnight = new Date('2026-08-14T16:30:00.000Z');
    // Test runner inherits Ubuntu's Asia/Shanghai local timezone.
    expect(toLocalDate(nearMidnight)).toBe('2026-08-15');
  });
});

describe('Today 时长统计', () => {
  it('分别计算计划、已完成与剩余分钟数', () => {
    const tasks = [
      task({ estimatedMinutes: 40 }),
      task({ estimatedMinutes: 30, completed: true, completedAt: '2026-08-14T02:00:00.000Z' }),
      task({ estimatedMinutes: 90, dueDate: '2026-08-15' }),
    ];
    expect(calculateTodayStats(tasks, NOW)).toEqual({
      plannedMinutes: 70,
      completedMinutes: 30,
      remainingMinutes: 40,
    });
  });
});
