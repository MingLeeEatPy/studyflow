import { executionSettingsSchema, type ExecutionSettings } from "../../shared/schemas/models";
import { db, defaultExecutionSettings, type StudyFlowDatabase } from "./database";

export class SettingsRepository {
  constructor(private readonly database: StudyFlowDatabase = db, private readonly clock = () => new Date()) {}

  async getExecutionSettings(): Promise<ExecutionSettings> {
    const existing = await this.database.executionSettings.get("default");
    if (existing) return executionSettingsSchema.parse(existing);
    const value = defaultExecutionSettings(this.clock().toISOString());
    await this.database.executionSettings.put(value);
    return value;
  }

  async updateExecutionSettings(input: Partial<Omit<ExecutionSettings, "id" | "updatedAt">>): Promise<ExecutionSettings> {
    const current = await this.getExecutionSettings();
    const value = executionSettingsSchema.parse({ ...current, ...input, id: "default", updatedAt: this.clock().toISOString() });
    await this.database.executionSettings.put(value);
    return value;
  }
}

export const settingsRepository = new SettingsRepository();
