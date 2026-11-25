// Row types come from the generated database types (npm run db:types); view shapes are composed here.
import type { Database } from "./database.types";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export type Stage = Database["public"]["Enums"]["job_stage"];
export const STAGES: Stage[] = ["unassigned", "assigned", "en_route", "arrived", "in_progress", "pending", "completed", "cancelled"];
export type Role = Database["public"]["Enums"]["member_role"];

export type Member = Row<"members">;
export type Client = Row<"clients">;
export type Site = Row<"sites">;
export type Job = Row<"jobs">;
export type JobEvent = Row<"job_events">;
export type Attachment = Row<"attachments">;
export type Resolution = Row<"resolutions">;

/** A job joined with what screens need. */
export interface JobView extends Job {
  site: Site;
  client: Client;
  assignees: Member[];
  resolution: Resolution | null;
}

export interface JobDetail extends JobView {
  events: (JobEvent & { member_name: string | null })[];
  attachments: (Attachment & { url: string | null })[];
}
