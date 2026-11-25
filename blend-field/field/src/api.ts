import * as Crypto from "expo-crypto";
import { offlineAccount, readOffline, writeOffline } from "./offline";
import { supabase } from "./supabase";
import { completionBlockers, nextAction, type FieldJob, type Member, type Outcome, type Stage } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** supabase-js reports network failures as errors with a fetch message; treat them as "offline" (status 0). */
function toApiError(e: { message: string; code?: string; status?: number }): ApiError {
  if (/fetch|network/i.test(e.message)) return new ApiError(0, "No connection. Your changes are kept on this phone.");
  if (e.code === "PGRST301" || e.status === 401) return new ApiError(401, "Sign in again.");
  return new ApiError(e.status ?? (e.code && /^[0-9A-Z]{5}$/.test(e.code) ? 400 : 500), e.message || "Something went wrong.");
}

async function run<T>(p: PromiseLike<{ data: T; error: { message: string; code?: string } | null }>): Promise<T> {
  let res: { data: T; error: { message: string; code?: string } | null };
  try {
    res = await p;
  } catch (e) {
    throw toApiError(e as Error);
  }
  if (res.error) throw toApiError(res.error);
  return res.data;
}

export async function me(): Promise<Member | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw toApiError(error);
  if (!user) return null;
  return run(supabase.from("members").select("*").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle());
}

const JOB_SELECT = "*, site:sites(id, label, address, access_notes), client:clients(id, name), resolution:resolutions(id, name, successful), attachments(id, kind, stage, taken_at, uploaded_at, signer_name)";
const withNext = (j: Omit<FieldJob, "next" | "blockers">): FieldJob => {
  const next = nextAction(j.stage);
  return { ...j, next, blockers: next?.to === "completed" ? completionBlockers(j.attachments) : [] };
};

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const owner = offlineAccount();
  try {
    const result = await load();
    if (owner === offlineAccount()) await writeOffline(key, result).catch(() => undefined);
    return result;
  } catch (error) {
    if (owner === offlineAccount() && error instanceof ApiError && error.status === 0) {
      const previous = await readOffline<T>(key).catch(() => undefined);
      if (previous !== undefined) return previous;
    }
    throw error;
  }
}

/** RLS returns only jobs assigned to the signed-in user. */
export async function myJobs(): Promise<FieldJob[]> {
  return cached("jobs", async () => {
    const rows = await run(supabase.from("jobs").select(JOB_SELECT).neq("stage", "cancelled")
      .order("scheduled_start", { ascending: true, nullsFirst: false }));
    return (rows as unknown as Omit<FieldJob, "next" | "blockers">[]).map(withNext);
  });
}

export async function myNotifications() {
  return cached("notifications", async () => (await run(supabase.rpc("my_workflow_alerts", { p_audience: "trade" }))) ?? []);
}

export async function myJob(id: string): Promise<FieldJob> {
  try {
    return await cached("job:" + id, async () => {
      const row = await run(supabase.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle());
      if (!row) throw new ApiError(404, "This job isn't assigned to you any more.");
      return withNext(row as unknown as Omit<FieldJob, "next" | "blockers">);
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      const previous = (await readOffline<FieldJob[]>("jobs"))?.find((job) => job.id === id);
      if (previous) return previous;
    }
    throw error;
  }
}

export type Op =
  | { op_id: string; type: "status"; job_id: string; to: Stage; occurred_at: string; resolution_id?: string; resolution_comment?: string | null; work_minutes?: number; overtime_minutes?: number; worker_signed?: boolean }
  | { op_id: string; type: "follow_up"; job_id: string; note?: string | null; occurred_at: string }
  | {
      op_id: string; type: "attachment"; job_id: string; attachment_id: string; kind: "photo" | "signature";
      stage: "before" | "during" | "after" | "other"; taken_at: string; signer_name?: string | null;
      content_type: string; bytes: number;
    };
export type OpResult = { op_id: string; status: "ok" | "duplicate" | "rejected"; reason?: string };

/** Applies queued ops in one database transaction per call; stage rules are enforced in field_apply_ops. */
export async function sync(ops: Op[]): Promise<{ results: OpResult[] }> {
  const results = await run(supabase.rpc("field_apply_ops", { p_ops: ops }));
  return { results: results as unknown as OpResult[] };
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/svg+xml": "svg" };
export const storagePath = (orgId: string, jobId: string, attachmentId: string, contentType: string) =>
  `${orgId}/${jobId}/${attachmentId}.${EXT[contentType] ?? "jpg"}`;

/** Uploads to the private job-files bucket (storage RLS checks the attachment is ours), then confirms it. */
export async function upload(attachmentId: string, path: string, body: ArrayBuffer, contentType: string) {
  try {
    const { error } = await supabase.storage.from("job-files").upload(path, body, { contentType, upsert: false });
    // "already exists" means a previous try uploaded it before losing signal: safe to confirm.
    if (error && !/exists|duplicate/i.test(error.message)) throw toApiError(error);
  } catch (e) {
    throw e instanceof ApiError ? e : toApiError(e as Error);
  }
  await run(supabase.rpc("field_mark_uploaded", { p_attachment: attachmentId, p_path: path }));
}

// Outcomes are cached after the first load so the outcome sheet still works without signal.
let outcomeCache: { all: Outcome[]; byType: Record<string, string[]> } | null = null;

/** Outcomes this job can end with: the job type's list if it has one, otherwise all of the org's. */
export async function outcomesFor(jobTypeId: string | null): Promise<Outcome[]> {
  let cache = outcomeCache;
  if (!cache) {
    const [all, links] = await cached("outcomes", () => Promise.all([
      run(supabase.from("resolutions").select("id, name, successful, requires_comment, suggest_follow_up, sort").eq("archived", false).order("sort")),
      run(supabase.from("job_type_resolutions").select("job_type_id, resolution_id")),
    ]));
    const byType: Record<string, string[]> = {};
    (links ?? []).forEach((l) => (byType[l.job_type_id] ??= []).push(l.resolution_id));
    cache = outcomeCache = { all: all ?? [], byType };
  }
  const allowed = jobTypeId ? cache.byType[jobTypeId] : undefined;
  return allowed?.length ? cache.all.filter((o) => allowed.includes(o.id)) : cache.all;
}
export const clearOutcomeCache = () => { outcomeCache = null; };

export const uuid = () => Crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
