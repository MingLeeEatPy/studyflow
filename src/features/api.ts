import type { Category, CreateCategoryInput, CreateTaskInput, Task, UpdateTaskInput } from "../domain/models";
import { backupRepository, categoryRepository, sessionRepository, settingsRepository, taskRepository } from "../db";

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
}

export const studyFlowApi: StudyFlowApi = {
  tasks: taskRepository,
  categories: categoryRepository,
  backup: backupRepository,
  sessions: sessionRepository,
  settings: settingsRepository,
};
