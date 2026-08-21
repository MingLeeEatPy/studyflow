import type { StudyFlowDatabase } from "./database";
import { db } from "./database";
import { NotFoundError } from "./errors";
import {
  createTaskInputSchema,
  taskSchema,
  updateTaskInputSchema,
  type CreateTaskInput,
  type Task,
  type TaskEvent,
  type TaskEventType,
  type UpdateTaskInput,
} from "../../shared/schemas/models";
import { compareTasks } from "../domain/today";

const createId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function eventFor(task: Task, type: TaskEventType, occurredAt: string, sequence: number): TaskEvent {
  return {
    id: createId(),
    taskId: task.id,
    sequence,
    type,
    occurredAt,
    snapshot: {
      title: task.title,
      categoryId: task.categoryId,
      estimatedMinutes: task.estimatedMinutes,
      dueDate: task.dueDate,
      important: task.important,
      urgent: task.urgent,
    },
  };
}

export class TaskRepository {
  constructor(private readonly database: StudyFlowDatabase = db) {}

  async list(options: { includeArchived?: boolean } = {}): Promise<Task[]> {
    const tasks = await this.database.tasks.toArray();
    return tasks.filter((task) => options.includeArchived || task.archivedAt === null).sort(compareTasks);
  }

  async get(id: string): Promise<Task> {
    const task = await this.database.tasks.get(id);
    if (!task) throw new NotFoundError("任务");
    return task;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const value = createTaskInputSchema.parse(input);
    const category = await this.database.categories.get(value.categoryId);
    if (!category || category.archivedAt !== null) throw new NotFoundError("分类");
    const timestamp = nowIso();
    if (value.planId) await this.requirePlan(value.planId);
    const task = taskSchema.parse({
      ...value,
      id: createId(),
      planId: value.planId ?? null, isCoreTask: value.isCoreTask ?? false, avoidanceCount: 0, minimumStartMinutes: value.minimumStartMinutes ?? null,
      completed: false,
      completedAt: null,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.database.transaction("rw", this.database.tasks, this.database.taskEvents, async () => {
      if (task.isCoreTask) await this.database.tasks.filter((item) => item.isCoreTask === true).modify({ isCoreTask: false, updatedAt: timestamp });
      await this.database.tasks.add(task);
      await this.database.taskEvents.add(eventFor(task, "created", timestamp, await this.nextEventSequence()));
    });
    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const value = updateTaskInputSchema.parse(input);
    const current = await this.get(id);
    if (current.archivedAt !== null) throw new NotFoundError("有效任务");
    if (value.categoryId) {
      const category = await this.database.categories.get(value.categoryId);
      if (!category || category.archivedAt !== null) throw new NotFoundError("分类");
    }
    if (value.planId) await this.requirePlan(value.planId);
    const timestamp = nowIso();
    const updated = taskSchema.parse({ ...current, ...value, updatedAt: timestamp });
    await this.database.transaction("rw", this.database.tasks, this.database.taskEvents, async () => {
      if (updated.isCoreTask) await this.database.tasks.filter((item) => item.id !== id && item.isCoreTask === true).modify({ isCoreTask: false, updatedAt: timestamp });
      await this.database.tasks.put(updated);
      await this.database.taskEvents.add(eventFor(updated, "updated", timestamp, await this.nextEventSequence()));
    });
    return updated;
  }

  async setCoreTask(id: string, enabled: boolean): Promise<Task> {
    return this.database.transaction("rw", this.database.tasks, this.database.taskEvents, async () => {
      const current = await this.get(id);
      if (current.archivedAt || current.completed) throw new NotFoundError("未完成任务");
      const timestamp = nowIso();
      if (enabled) await this.database.tasks.filter((task) => task.isCoreTask === true).modify({ isCoreTask: false, updatedAt: timestamp });
      const updated = taskSchema.parse({ ...current, isCoreTask: enabled, updatedAt: timestamp });
      await this.database.tasks.put(updated);
      await this.database.taskEvents.add(eventFor(updated, "updated", timestamp, await this.nextEventSequence()));
      return updated;
    });
  }

  async recordAvoidance(id: string): Promise<void> {
    const task = await this.database.tasks.get(id);
    if (!task?.isCoreTask || task.completed || task.archivedAt) return;
    await this.database.tasks.update(id, { avoidanceCount: (task.avoidanceCount ?? 0) + 1, updatedAt: nowIso() });
  }

  async toggleComplete(id: string, completed?: boolean): Promise<Task> {
    const current = await this.get(id);
    if (current.archivedAt !== null) throw new NotFoundError("有效任务");
    const nextCompleted = completed ?? !current.completed;
    if (nextCompleted === current.completed) return current;
    const timestamp = nowIso();
    const updated = taskSchema.parse({
      ...current,
      completed: nextCompleted,
      completedAt: nextCompleted ? timestamp : null,
      updatedAt: timestamp,
    });
    await this.database.transaction("rw", this.database.tasks, this.database.taskEvents, async () => {
      await this.database.tasks.put(updated);
      await this.database.taskEvents.add(
        eventFor(updated, nextCompleted ? "completed" : "reopened", timestamp, await this.nextEventSequence()),
      );
    });
    return updated;
  }

  async archive(id: string): Promise<void> {
    const current = await this.get(id);
    if (current.archivedAt !== null) return;
    const timestamp = nowIso();
    const archived = taskSchema.parse({ ...current, archivedAt: timestamp, updatedAt: timestamp });
    await this.database.transaction("rw", this.database.tasks, this.database.taskEvents, async () => {
      await this.database.tasks.put(archived);
      await this.database.taskEvents.add(eventFor(archived, "archived", timestamp, await this.nextEventSequence()));
    });
  }

  private async nextEventSequence(): Promise<number> {
    const lastEvent = await this.database.taskEvents.orderBy("sequence").last();
    return (lastEvent?.sequence ?? 0) + 1;
  }
  private async requirePlan(id: string): Promise<void> {
    const plan = await this.database.planningPeriods.get(id);
    if (!plan || plan.type !== "week") throw new NotFoundError("周计划");
  }
}

export const taskRepository = new TaskRepository();
