import { weeklyWorkloadPlanSchema, type WeeklyWorkloadPlan } from "../../shared/schemas/models";
import { db, type StudyFlowDatabase } from "./database";

export type SaveWeeklyWorkloadPlanInput = Pick<WeeklyWorkloadPlan, "weekStart" | "totalPlannedActions" | "allocations">;

export class WeeklyWorkloadPlanRepository {
  constructor(private readonly database: StudyFlowDatabase = db, private readonly now = () => new Date().toISOString()) {}

  async get(weekStart: string): Promise<WeeklyWorkloadPlan | undefined> {
    return this.database.weeklyWorkloadPlans.where("weekStart").equals(weekStart).first();
  }

  async list(): Promise<WeeklyWorkloadPlan[]> {
    return (await this.database.weeklyWorkloadPlans.toArray()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  async save(input: SaveWeeklyWorkloadPlanInput): Promise<WeeklyWorkloadPlan> {
    const current = await this.get(input.weekStart);
    const timestamp = this.now();
    const plan = weeklyWorkloadPlanSchema.parse({
      ...input,
      id: current?.id ?? `week:${input.weekStart}`,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    await this.database.weeklyWorkloadPlans.put(plan);
    return plan;
  }
}

export const weeklyWorkloadPlanRepository = new WeeklyWorkloadPlanRepository();
