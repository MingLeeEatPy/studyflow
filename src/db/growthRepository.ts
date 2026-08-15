import type { GrowthRecord } from "../../shared/schemas/models";
import { db, type StudyFlowDatabase } from "./database";

export class GrowthRepository {
  constructor(private readonly database: StudyFlowDatabase = db) {}

  async list(): Promise<GrowthRecord[]> {
    return (await this.database.growthRecords.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listForLocalDate(localDate: string): Promise<GrowthRecord[]> {
    return (await this.database.growthRecords.where("localDate").equals(localDate).toArray())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getForSourceSession(sourceSessionId: string): Promise<GrowthRecord | undefined> {
    return this.database.growthRecords.where("sourceSessionId").equals(sourceSessionId).first();
  }
}

export const growthRepository = new GrowthRepository();
