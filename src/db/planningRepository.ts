import { planningPeriodSchema, type PlanningPeriod, type PlanningPeriodType } from "../../shared/schemas/models";
import { db, type StudyFlowDatabase } from "./database";
import { ConflictError, NotFoundError } from "./errors";

export type PlanningPeriodInput = Pick<PlanningPeriod, "type" | "title" | "startDate" | "endDate" | "parentId" | "note">;

export class PlanningRepository {
  constructor(private readonly database: StudyFlowDatabase = db, private readonly createId = () => crypto.randomUUID(), private readonly now = () => new Date().toISOString()) {}
  async list(): Promise<PlanningPeriod[]> { return (await this.database.planningPeriods.toArray()).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.type.localeCompare(b.type)); }
  async create(input: PlanningPeriodInput): Promise<PlanningPeriod> {
    const timestamp = this.now();
    const value = planningPeriodSchema.parse({ ...input, id: this.createId(), createdAt: timestamp, updatedAt: timestamp });
    if (value.type === "week") {
      if (!value.parentId) throw new ConflictError("周计划必须归属一个月度计划");
      const parent = await this.database.planningPeriods.get(value.parentId);
      if (!parent || parent.type !== "month") throw new NotFoundError("月度计划");
      if (value.startDate < parent.startDate || value.endDate > parent.endDate) throw new ConflictError("周计划必须位于所属月度计划内");
    }
    await this.database.planningPeriods.add(value); return value;
  }
  async remove(id: string): Promise<void> {
    const period = await this.database.planningPeriods.get(id); if (!period) throw new NotFoundError("计划");
    if (await this.database.tasks.where("planId").equals(id).count()) throw new ConflictError("仍有任务关联此计划，不能删除");
    if (await this.database.planningPeriods.where("parentId").equals(id).count()) throw new ConflictError("仍有周计划关联此月度计划，不能删除");
    await this.database.planningPeriods.delete(id);
  }
  async get(id: string): Promise<PlanningPeriod> { const item = await this.database.planningPeriods.get(id); if (!item) throw new NotFoundError("计划"); return item; }
  async listByType(type: PlanningPeriodType): Promise<PlanningPeriod[]> { return (await this.list()).filter((item) => item.type === type); }
}
export const planningRepository = new PlanningRepository();
