import type { FinishMeditationInput, MeditationSession, StartMeditationInput } from "../../shared/schemas/models";
import { studyFlowApi } from "./api";

function changed<T>(operation: Promise<T>): Promise<T> {
  return operation.then((value) => {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("studyflow-execution");
      channel.postMessage("changed"); setTimeout(() => channel.close(), 100);
    }
    return value;
  });
}

export const meditationAdapter = {
  start: (input: StartMeditationInput) => changed(studyFlowApi.meditation.start(input)),
  beginOrSkipBreathing: (session: MeditationSession) => changed(studyFlowApi.meditation.beginOrSkipBreathing(session.id, session.revision)),
  pause: (session: MeditationSession) => changed(studyFlowApi.meditation.pause(session.id, session.revision)),
  resume: (session: MeditationSession) => changed(studyFlowApi.meditation.resume(session.id, session.revision)),
  reportSleepGap: (session: MeditationSession, from: string, to: string) => changed(studyFlowApi.meditation.reportSleepGap(session.id, from, to, session.revision)),
  resolveSleepGap: (session: MeditationSession, input: { intervalId: string; gapIndex: number; resolution: "include" | "exclude" | "correct"; correctedSeconds?: number }) => changed(studyFlowApi.meditation.resolveSleepGap(session.id, input, session.revision)),
  finish: (session: MeditationSession, input: FinishMeditationInput) => changed(studyFlowApi.meditation.finish(session.id, input, session.revision)),
  discard: (session: MeditationSession) => changed(studyFlowApi.meditation.discard(session.id)),
  getActive: () => studyFlowApi.meditation.getActive(),
  history: () => studyFlowApi.meditation.listHistory(),
  listIntervals: (sessionId: string) => studyFlowApi.meditation.listIntervals(sessionId),
};
