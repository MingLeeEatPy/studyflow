import type { ExecutionSettings, FinishSessionInput, StartSessionInput, StudySession } from "../../shared/schemas/models";
import type { HistoryFilter, SessionCorrectionInput } from "./executionTypes";
import { studyFlowApi } from "./api";
function changed<T>(operation:Promise<T>):Promise<T>{return operation.then(value=>{if(typeof BroadcastChannel!=="undefined"){const channel=new BroadcastChannel("studyflow-execution");channel.postMessage("changed");setTimeout(()=>channel.close(),100)}return value})}
export const executionAdapter={
 isAvailable:()=>true,getActive:async()=>await studyFlowApi.sessions.getActive()??null,listIntervals:(id:string)=>studyFlowApi.sessions.listIntervals(id),
 start:(mode:"stopwatch"|"pomodoro",input:StartSessionInput)=>changed(mode==="stopwatch"?studyFlowApi.sessions.startStopwatch(input):studyFlowApi.sessions.startPomodoro(input)),
 pause:(value:StudySession)=>changed(studyFlowApi.sessions.pause(value.id,value.revision)),resume:(value:StudySession)=>changed(studyFlowApi.sessions.resume(value.id,value.revision)),
 advance:(value:StudySession,action:"start-break"|"skip-break"|"start-focus")=>changed(studyFlowApi.sessions.advancePomodoro(value.id,action,value.revision)),
 completeStage:(value:StudySession)=>changed(studyFlowApi.sessions.completeCurrentStage(value.id,value.revision)),autoPause:(value:StudySession)=>changed(studyFlowApi.sessions.autoPauseIfNeeded(value.id,value.revision)),
 reportSleepGap:(value:StudySession,from:string,to:string)=>changed(studyFlowApi.sessions.reportSleepGap(value.id,from,to,value.revision)),
 finish:(value:StudySession,input:FinishSessionInput)=>changed(studyFlowApi.sessions.finish(value.id,input,value.revision)),discard:(id:string)=>changed(studyFlowApi.sessions.discard(id)),history:(filter?:HistoryFilter)=>studyFlowApi.sessions.listHistory(filter),
 correct:(session:StudySession,input:SessionCorrectionInput)=>changed(studyFlowApi.sessions.correct(session.id,{session:{outcome:input.outcome,failureReason:input.failureReason,note:input.note,summary:input.summary},intervals:input.intervals,reason:input.revisionReason},session.revision)),
 resolveSleepGap:(value:StudySession,input:{intervalId:string;gapIndex:number;resolution:"include"|"exclude"|"correct";correctedSeconds?:number})=>changed(studyFlowApi.sessions.resolveSleepGap(value.id,input,value.revision)),
 getSettings:()=>studyFlowApi.settings.getExecutionSettings(),saveSettings:(input:Partial<ExecutionSettings>)=>changed(studyFlowApi.settings.updateExecutionSettings(input)),
};
export function elapsedFocusSeconds(value:StudySession,now=Date.now()){return value.status==="running"?Math.max(0,Math.floor((now-Date.parse(value.startedAt))/1000)):0}
export function formatDuration(total:number){const safe=Math.max(0,Math.floor(total)),h=Math.floor(safe/3600),m=Math.floor((safe%3600)/60),s=safe%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
