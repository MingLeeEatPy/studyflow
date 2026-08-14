import Dexie, { type Table } from "dexie";
import type { Category, Task, TaskEvent } from "../domain/models";

export const DEFAULT_CATEGORY_NAMES = ["高数", "线性代数", "C", "CS50", "其他"] as const;

function createId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export class StudyFlowDatabase extends Dexie {
  tasks!: Table<Task, string>;
  categories!: Table<Category, string>;
  taskEvents!: Table<TaskEvent, string>;

  constructor(name = "StudyFlow") {
    super(name);
    this.version(1).stores({
      tasks: "id, categoryId, dueDate, completed, archivedAt, createdAt",
      categories: "id, &name, sortOrder, archivedAt, createdAt",
      taskEvents: "id, taskId, &sequence, type, occurredAt",
    });

    this.on("populate", () => {
      const timestamp = nowIso();
      return this.categories.bulkAdd(
        DEFAULT_CATEGORY_NAMES.map((name, sortOrder) => ({
          id: createId(),
          name,
          sortOrder,
          archivedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      );
    });
  }
}

export const db = new StudyFlowDatabase();
