import type { Task } from "./models";

export type Quadrant =
  | "important-urgent"
  | "important-not-urgent"
  | "not-important-urgent"
  | "not-important-not-urgent";

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  "important-urgent": "重要且紧急",
  "important-not-urgent": "重要但不紧急",
  "not-important-urgent": "不重要但紧急",
  "not-important-not-urgent": "不重要且不紧急",
};

export function getTaskQuadrant(task: Pick<Task, "important" | "urgent">): Quadrant {
  if (task.important && task.urgent) return "important-urgent";
  if (task.important) return "important-not-urgent";
  if (task.urgent) return "not-important-urgent";
  return "not-important-not-urgent";
}

export function groupTasksByQuadrant(tasks: Task[]): Record<Quadrant, Task[]> {
  const groups: Record<Quadrant, Task[]> = {
    "important-urgent": [],
    "important-not-urgent": [],
    "not-important-urgent": [],
    "not-important-not-urgent": [],
  };
  for (const task of tasks) groups[getTaskQuadrant(task)].push(task);
  return groups;
}

