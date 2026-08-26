import type { Category, CreateCategoryInput, CreateTaskInput, Task, UpdateTaskInput } from "../domain/models";
import { backupRepository, categoryRepository, dailyReviewRepository, growthRepository, meditationRepository, planningRepository, sessionRepository, settingsRepository, taskRepository } from "../db";
import { enqueueSyncChange } from "../domain/sync";

async function queueEntity(entityType: "task" | "category", entity: { id: string; updatedAt: string; }): Promise<void> {
  await enqueueSyncChange({ entityType, entityId: entity.id, operation: "upsert", payload: entity, updatedAt: entity.updatedAt });
}

const taskApi: StudyFlowApi["tasks"] = {
  list: () => taskRepository.list(),
  create: async (input) => { const entity = await taskRepository.create(input); await queueEntity("task", entity); return entity; },
  update: async (id, input) => { const entity = await taskRepository.update(id, input); await queueEntity("task", entity); return entity; },
  toggleComplete: async (id, completed) => { const entity = await taskRepository.toggleComplete(id, completed); await queueEntity("task", entity); return entity; },
  archive: async (id) => { await taskRepository.archive(id); const entity = (await taskRepository.list({ includeArchived: true })).find((item) => item.id === id); if (entity) await queueEntity("task", entity); },
};

const categoryApi: StudyFlowApi["categories"] = {
  list: () => categoryRepository.list(),
  create: async (input) => { const entity = await categoryRepository.create(input); await queueEntity("category", entity); return entity; },
  update: async (id, input) => { const entity = await categoryRepository.update(id, input); await queueEntity("category", entity); return entity; },
  archive: async (id) => { await categoryRepository.archive(id); const entity = (await categoryRepository.list({ includeArchived: true })).find((item) => item.id === id); if (entity) await queueEntity("category", entity); },
};

export interface StudyFlowApi {
  tasks: {
    list(): Promise<Task[]>;
    create(input: CreateTaskInput): Promise<Task>;
    update(id: string, input: UpdateTaskInput): Promise<Task>;
    toggleComplete(id: string, completed?: boolean): Promise<Task>;
    archive(id: string): Promise<void>;
  };
  categories: {
    list(): Promise<Category[]>;
    create(input: CreateCategoryInput): Promise<Category>;
    update(id: string, input: CreateCategoryInput): Promise<Category>;
    archive(id: string): Promise<void>;
  };
  backup: {
    exportData(): Promise<unknown>;
    replaceAll(input: unknown): Promise<void>;
  };
  sessions: typeof sessionRepository;
  settings: typeof settingsRepository;
  growth: typeof growthRepository;
  meditation: typeof meditationRepository;
  planning: typeof planningRepository;
  dailyReviews: typeof dailyReviewRepository;
}

export const studyFlowApi: StudyFlowApi = {
  tasks: taskApi,
  categories: categoryApi,
  backup: backupRepository,
  sessions: sessionRepository,
  settings: settingsRepository,
  growth: growthRepository,
  meditation: meditationRepository,
  planning: planningRepository,
  dailyReviews: dailyReviewRepository,
};
