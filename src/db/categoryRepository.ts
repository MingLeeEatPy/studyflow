import type { StudyFlowDatabase } from "./database";
import { db } from "./database";
import { ConflictError, NotFoundError } from "./errors";
import {
  categorySchema,
  createCategoryInputSchema,
  type Category,
  type CreateCategoryInput,
} from "../../shared/schemas/models";

const createId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const normalizeName = (name: string) => name.trim().toLocaleLowerCase();

export class CategoryRepository {
  constructor(private readonly database: StudyFlowDatabase = db) {}

  async list(options: { includeArchived?: boolean } = {}): Promise<Category[]> {
    const categories = await this.database.categories.toArray();
    return categories
      .filter((category) => options.includeArchived || category.archivedAt === null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }

  private async assertUnique(name: string, exceptId?: string): Promise<void> {
    const normalized = normalizeName(name);
    const duplicate = (await this.database.categories.toArray()).find(
      (item) => item.id !== exceptId && item.archivedAt === null && normalizeName(item.name) === normalized,
    );
    if (duplicate) throw new ConflictError("分类名称已存在");
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const value = createCategoryInputSchema.parse(input);
    return this.database.transaction("rw", this.database.categories, async () => {
      await this.assertUnique(value.name);
      const lastCategory = await this.database.categories.orderBy("sortOrder").last();
      const timestamp = nowIso();
      const category = categorySchema.parse({
        id: createId(),
        name: value.name,
        sortOrder: (lastCategory?.sortOrder ?? -1) + 1,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await this.database.categories.add(category);
      return category;
    });
  }

  async update(id: string, input: CreateCategoryInput): Promise<Category> {
    const value = createCategoryInputSchema.parse(input);
    const current = await this.database.categories.get(id);
    if (!current || current.archivedAt !== null) throw new NotFoundError("分类");
    await this.assertUnique(value.name, id);
    const updated = categorySchema.parse({ ...current, name: value.name, updatedAt: nowIso() });
    await this.database.categories.put(updated);
    return updated;
  }

  async archive(id: string): Promise<void> {
    const category = await this.database.categories.get(id);
    if (!category || category.archivedAt !== null) throw new NotFoundError("分类");
    const activeCategories = await this.database.categories.filter((item) => item.archivedAt === null).count();
    if (activeCategories <= 1) throw new ConflictError("必须至少保留一个分类");
    const used = await this.database.tasks.where("categoryId").equals(id).filter((task) => task.archivedAt === null).count();
    if (used > 0) throw new ConflictError("该分类仍有任务，无法删除");
    const timestamp = nowIso();
    await this.database.categories.put({ ...category, archivedAt: timestamp, updatedAt: timestamp });
  }
}

export const categoryRepository = new CategoryRepository();
