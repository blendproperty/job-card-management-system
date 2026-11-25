"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOffice } from "@/server/auth";
import { supabaseServer } from "@/server/supabase";
import { assignJob, createJob, Invalid, NotFound } from "@/server/repo";
import { localInputToIso } from "@/lib/format";

// ───────── sign in: emailed 6-digit code (invite-only; nobody can sign themselves up) ─────────

export type SignInState = { step: "email" | "code"; email?: string; error?: string; info?: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export async function sendCodeAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { step: "email", error: parsed.error.issues[0].message };
  const email = parsed.data;
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  // Same answer whether or not the address is on the team, so the form can't be used to find accounts.
  if (error && error.status === 429) return { step: "email", email, error: "Too many tries. Wait a minute and try again." };
  return { step: "code", email, info: `If ${email} is on the team, a 6-digit code is on its way. It expires in 10 minutes.` };
}

export async function verifyCodeAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = emailSchema.safeParse(form.get("email"));
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!email.success) return { step: "email", error: "Start again with your email address." };
  if (code.length !== 6) return { step: "code", email: email.data, error: "Enter the 6 digits from the email." };
  const db = await supabaseServer();
  const { error } = await db.auth.verifyOtp({ email: email.data, token: code, type: "email" });
  if (error) {
    return { step: "code", email: email.data, error: error.status === 429 ? "Too many tries. Wait a minute." : "That code didn't work. Check it, or send a new one." };
  }
  redirect("/jobs");
}

export async function signOutAction() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/login");
}

// ───────── jobs ─────────

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const createSchema = z.object({
  title: z.string({ error: "Give the job a short title." }).trim()
    .min(3, "Give the job a short title (3+ characters).").max(120, "Keep the title under 120 characters."),
  site_id: z.string({ error: "Pick a site." }).uuid("Pick a site."),
  description: z.string().trim().max(2000).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  estimate_min: z.coerce.number().int().positive("Estimate must be more than 0.").max(24 * 60).optional(),
  assignee_id: z.string().uuid().optional(),
});

/** F01: create a job (and optionally assign it in one go). */
export async function createJobAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireOffice();
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ""));
  const parsed = createSchema.safeParse(clean);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: raw };
  const d = parsed.data;
  let id: string;
  try {
    const job = await createJob(me, {
      site_id: d.site_id,
      title: d.title,
      description: d.description,
      scheduled_start: localInputToIso(d.start),
      scheduled_end: localInputToIso(d.end),
      estimate_min: d.estimate_min ?? null,
      assignee_id: d.assignee_id ?? null,
    });
    id = job.id;
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, fields: raw };
    throw e;
  }
  revalidatePath("/jobs");
  redirect(`/jobs/${id}?created=1`);
}

export async function assignJobAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireOffice();
  const jobId = z.string().uuid().safeParse(form.get("job_id"));
  const memberId = z.string().uuid().safeParse(form.get("member_id"));
  if (!jobId.success) return { error: "Job not found." };
  if (!memberId.success) return { error: "Pick someone to do the job." };
  try {
    await assignJob(me, jobId.data, [memberId.data]);
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message };
    if (e instanceof NotFound) return { error: "Job not found." };
    throw e;
  }
  revalidatePath(`/jobs/${jobId.data}`);
  revalidatePath("/jobs");
  return undefined;
}
