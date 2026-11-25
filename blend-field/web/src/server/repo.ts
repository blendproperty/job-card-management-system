import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { isOfficeRole } from "./roles";
import type { Actor } from "./auth";
import type { Job, JobDetail, JobView, Member, Site, Stage } from "./types";

/**
 * Office data layer on Supabase. Every query runs as the signed-in user, so the RLS policies in
 * supabase/migrations decide what comes back; the checks here are for clear errors, not security.
 * Field writes don't come through here: the phone calls field_apply_ops directly.
 */

export class Forbidden extends Error {}
export class NotFound extends Error {}
export class Invalid extends Error {}

const isOffice = (m: Member) => isOfficeRole(m.role);

function fail(e: PostgrestError): never {
  if (e.code === "P0001") throw new Invalid(e.message);
  if (e.code === "P0002" || e.code === "PGRST116") throw new NotFound();
  if (e.code === "42501") throw new Forbidden();
  throw new Error(`${e.code}: ${e.message}`);
}

const JOB_SELECT = "*, site:sites(*), client:clients(*), resolution:resolutions(*), job_assignments(member:members(*))";

type JobRow = Job & {
  site: JobView["site"];
  client: JobView["client"];
  resolution: JobView["resolution"];
  job_assignments: { member: Member | null }[];
};
const toView = ({ job_assignments, ...j }: JobRow): JobView => ({
  ...j,
  assignees: job_assignments.map((a) => a.member).filter((m): m is Member => !!m),
});

// ───────── reference data ─────────

export async function listMembers(actor: Actor, opts: { field?: boolean } = {}): Promise<Member[]> {
  let q = actor.db.from("members").select("*").eq("org_id", actor.org_id).eq("active", true).order("display_name");
  if (opts.field) q = q.in("role", ["engineer", "contractor"]);
  const { data, error } = await q;
  if (error) fail(error);
  return data;
}

export async function listSitesForPicker(actor: Actor): Promise<(Site & { client_name: string })[]> {
  if (!isOffice(actor)) throw new Forbidden();
  const { data, error } = await actor.db.from("sites").select("*, client:clients(name)").eq("org_id", actor.org_id).order("label");
  if (error) fail(error);
  return data.map(({ client, ...s }) => ({ ...s, client_name: client?.name ?? "" }));
}

// ───────── jobs ─────────

export type JobTab = "all" | "unassigned" | "assigned" | "in_progress" | "pending" | "completed";
const TAB_STAGES: Record<JobTab, Stage[] | null> = {
  all: null,
  unassigned: ["unassigned"],
  assigned: ["assigned"],
  in_progress: ["en_route", "arrived", "in_progress"],
  pending: ["pending"],
  completed: ["completed"],
};

/** M0: loads the org's open + recent jobs and filters in memory. Server-side paging/search lands with S03 sorting (M1). */
export async function listJobs(actor: Actor, tab: JobTab = "all", q = "") {
  if (!isOffice(actor)) throw new Forbidden();
  const { data, error } = await actor.db
    .from("jobs").select(JOB_SELECT)
    .eq("org_id", actor.org_id).neq("stage", "cancelled")
    .order("scheduled_start", { ascending: true, nullsFirst: false }).order("number", { ascending: false })
    .limit(500);
  if (error) fail(error);
  const all = (data as unknown as JobRow[]).map(toView);
  const needle = q.trim().toLowerCase();
  const matches = (j: JobView) =>
    !needle || String(j.number).includes(needle) || j.title.toLowerCase().includes(needle) ||
    j.site.label.toLowerCase().includes(needle) || j.client.name.toLowerCase().includes(needle);
  const inTab = (t: JobTab, j: JobView) => !TAB_STAGES[t] || TAB_STAGES[t]!.includes(j.stage);
  const counts = Object.fromEntries((Object.keys(TAB_STAGES) as JobTab[]).map((t) => [t, all.filter((j) => inTab(t, j) && matches(j)).length])) as Record<JobTab, number>;
  return { jobs: all.filter((j) => inTab(tab, j) && matches(j)), counts };
}

export async function getJob(actor: Actor, id: string): Promise<JobDetail> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFound();
  const [job, events, atts] = await Promise.all([
    actor.db.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle(),
    actor.db.from("job_events").select("*, member:members(display_name)").eq("job_id", id).order("occurred_at"),
    actor.db.from("attachments").select("*").eq("job_id", id).order("taken_at"),
  ]);
  if (job.error) fail(job.error);
  if (!job.data) throw new NotFound();
  if (events.error) fail(events.error);
  if (atts.error) fail(atts.error);

  // Short-lived signed URLs; storage RLS only signs files this user may read.
  const paths = atts.data.filter((a) => a.storage_path).map((a) => a.storage_path!);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await actor.db.storage.from("job-files").createSignedUrls(paths, 300);
    data?.forEach((s) => s.path && s.signedUrl && urls.set(s.path, s.signedUrl));
  }
  return {
    ...toView(job.data as unknown as JobRow),
    events: events.data.map(({ member, ...e }) => ({ ...e, member_name: member?.display_name ?? null })),
    attachments: atts.data.map((a) => ({ ...a, url: a.storage_path ? urls.get(a.storage_path) ?? null : null })),
  };
}

export interface CreateJobInput {
  site_id: string;
  title: string;
  description?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  estimate_min?: number | null;
  assignee_id?: string | null;
  trade: string;
  requester_user_id?: string;
}

export async function createJob(actor: Actor, input: CreateJobInput): Promise<Job> {
  if (!isOffice(actor)) throw new Forbidden();
  if (input.scheduled_start && input.scheduled_end && input.scheduled_end <= input.scheduled_start)
    throw new Invalid("The slot must end after it starts.");
  const { data: site } = await actor.db.from("sites").select("id, client_id").eq("id", input.site_id).maybeSingle();
  if (!site) throw new Invalid("Pick a site.");
  const { data: job, error } = await actor.db
    .from("jobs")
    .insert({
      org_id: actor.org_id,
      number: undefined as unknown as number, // assigned by the jobs_number trigger
      client_id: site.client_id,
      site_id: site.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      scheduled_start: input.scheduled_start ?? null,
      scheduled_end: input.scheduled_end ?? null,
      estimate_min: input.estimate_min ?? null,
      created_by: actor.id,
      trade: input.trade,
      requester_user_id: input.requester_user_id ?? null,
      approval: "awaiting",
      preferred_worker: input.assignee_id ?? null,
    })
    .select()
    .single();
  if (error) fail(error);
  return job;
}

export async function assignJob(actor: Actor, jobId: string, memberIds: string[]): Promise<Job> {
  if (!isOffice(actor)) throw new Forbidden();
  const { data, error } = await actor.db.rpc("assign_job", { p_job: jobId, p_members: memberIds });
  if (error) fail(error);
  return data as Job;
}
