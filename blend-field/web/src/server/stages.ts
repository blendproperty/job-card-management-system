import type { Attachment, Stage } from "./types";

export interface NextAction { to: Stage; label: string }

/** Legal transitions a field user may request. The database enforces the same list in field_apply_ops. */
const FIELD_TRANSITIONS: Partial<Record<Stage, Stage[]>> = {
  assigned: ["en_route"],
  en_route: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["completed", "pending"],
  pending: ["in_progress"],
};

export function canFieldMove(from: Stage, to: Stage): boolean {
  return FIELD_TRANSITIONS[from]?.includes(to) ?? false;
}

const NEXT_LABEL: Partial<Record<Stage, NextAction>> = {
  assigned: { to: "en_route", label: "I'm on my way" },
  en_route: { to: "arrived", label: "I've arrived" },
  arrived: { to: "in_progress", label: "Start work" },
  in_progress: { to: "completed", label: "Complete job" },
  pending: { to: "in_progress", label: "Resume work" },
};

export function nextAction(stage: Stage): NextAction | null {
  return NEXT_LABEL[stage] ?? null;
}

/** What still stops a job from being completed. Empty = can complete.
 *  Counts recorded attachments, uploaded or not: a job may complete while photos are still uploading. */
export function completionBlockers(attachments: Attachment[]): string[] {
  const blockers: string[] = [];
  if (!attachments.some((a) => a.kind === "photo")) blockers.push("Add at least one photo");
  if (!attachments.some((a) => a.kind === "signature")) blockers.push("Get the customer's signature");
  return blockers;
}

export const STAGE_LABEL: Record<Stage, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  en_route: "En route",
  arrived: "Arrived",
  in_progress: "In progress",
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};
