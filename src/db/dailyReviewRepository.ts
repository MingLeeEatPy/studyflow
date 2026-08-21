import { dailyReviewSchema, type DailyReview } from "../../shared/schemas/models";
import { db, type StudyFlowDatabase } from "./database";

export type DailyReviewInput = Pick<DailyReview, "localDate" | "timezone" | "plannedMinutes" | "completedMinutes" | "actualFocusMinutes" | "matchesExpectation" | "blocker" | "nextStep">;

export class DailyReviewRepository {
  constructor(private readonly database: StudyFlowDatabase = db, private readonly clock = () => new Date(), private readonly createId = () => crypto.randomUUID()) {}
  async get(localDate: string): Promise<DailyReview | undefined> { return this.database.dailyReviews.where("localDate").equals(localDate).first(); }
  async save(input: DailyReviewInput): Promise<DailyReview> {
    const now = this.clock().toISOString(); const existing = await this.get(input.localDate);
    const review = dailyReviewSchema.parse({ ...input, id: existing?.id ?? this.createId(), createdAt: existing?.createdAt ?? now, updatedAt: now });
    await this.database.dailyReviews.put(review); return review;
  }
}
export const dailyReviewRepository = new DailyReviewRepository();
