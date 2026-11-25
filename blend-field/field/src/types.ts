import type { Database } from "./database.types";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Stage = Database["public"]["Enums"]["job_stage"];
export type Member = Row<"members">;
export type Attachment = Pick<Row<"attachments">, "id" | "kind" | "stage" | "taken_at" | "uploaded_at" | "signer_name">;

export type Outcome = Pick<Row<"resolutions">, "id" | "name" | "successful" | "requires_comment" | "suggest_follow_up" | "sort">;

export type FieldJob = Row<"jobs"> & {
  resolution: Pick<Row<"resolutions">, "id" | "name" | "successful"> | null;
  site: Pick<Row<"sites">, "id" | "label" | "address" | "access_notes">;
  client: Pick<Row<"clients">, "id" | "name">;
  attachments: Attachment[];
  next: { to: Stage; label: string } | null;
  blockers: string[];
};

export const STAGE_LABEL: Record<Stage, string> = {
  unassigned: "Unassigned", assigned: "Assigned", en_route: "En route", arrived: "Arrived",
  in_progress: "In progress", pending: "Pending", completed: "Completed", cancelled: "Cancelled",
};

// Mirrors field_apply_ops in the database, which is the authority; this only drives the button.
const NEXT: Partial<Record<Stage, { to: Stage; label: string }>> = {
  assigned: { to: "en_route", label: "I'm on my way" },
  en_route: { to: "arrived", label: "I've arrived" },
  arrived: { to: "in_progress", label: "Start work" },
  in_progress: { to: "completed", label: "Complete job" },
  pending: { to: "in_progress", label: "Resume work" },
};
export const nextAction = (s: Stage) => NEXT[s] ?? null;

export function completionBlockers(atts: Attachment[]) {
  const b: string[] = [];
  if (!atts.some((a) => a.kind === "photo")) b.push("Add at least one photo");
  if (!atts.some((a) => a.kind === "signature")) b.push("Get the customer's signature");
  return b;
}
