import type { Category, Task } from "../domain/models";
import type { FailureReason, SessionOutcome } from "../../shared/schemas/models";
export type { ExecutionSettings, FailureReason, FinishSessionInput, SessionOutcome, SessionRevision, SessionStatus, StartSessionInput, StudyInterval, StudySession, TimerMode } from "../../shared/schemas/models";
/** 以下仅为界面输入，不是持久化领域模型。 */
export interface HistoryFilter { from?: string; to?: string; categoryId?: string; taskId?: string; outcome?: SessionOutcome }
export interface SessionCorrectionInput { outcome?: SessionOutcome; failureReason?: FailureReason | null; note?: string; summary?: string; intervals?: import("../../shared/schemas/models").StudyInterval[]; revisionReason: string }
export type StartContext = { task?: Task; category?: Category };
