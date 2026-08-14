import { z } from "zod";

export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须为 YYYY-MM-DD");
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "任务标题不能为空").max(200),
  categoryId: z.string().min(1),
  estimatedMinutes: z.number().int().min(1).max(1440),
  dueDate: localDateSchema,
  important: z.boolean(),
  urgent: z.boolean(),
  completed: z.boolean(),
  completedAt: isoDateTimeSchema.nullable(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "分类名称不能为空").max(80),
  sortOrder: z.number().int().nonnegative(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const taskSnapshotSchema = taskSchema.pick({
  title: true,
  categoryId: true,
  estimatedMinutes: true,
  dueDate: true,
  important: true,
  urgent: true,
});

export const taskEventTypeSchema = z.enum(["created", "updated", "completed", "reopened", "archived"]);

export const taskEventSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  sequence: z.number().int().positive(),
  type: taskEventTypeSchema,
  occurredAt: isoDateTimeSchema,
  snapshot: taskSnapshotSchema,
});

export const createTaskInputSchema = taskSchema.pick({
  title: true,
  categoryId: true,
  estimatedMinutes: true,
  dueDate: true,
  important: true,
  urgent: true,
});

export const updateTaskInputSchema = createTaskInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "至少需要修改一个字段",
);

export const createCategoryInputSchema = categorySchema.pick({ name: true });
export const updateCategoryInputSchema = createCategoryInputSchema;

export type Task = z.infer<typeof taskSchema>;
export type Category = z.infer<typeof categorySchema>;
export type TaskEvent = z.infer<typeof taskEventSchema>;
export type TaskEventType = z.infer<typeof taskEventTypeSchema>;
export type TaskSnapshot = z.infer<typeof taskSnapshotSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
