"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, max } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { canInspect, canManageJobs, canSeeProperty, isWorker } from "@/lib/permissions";
import { isUuid, str } from "@/lib/format";
import { loadJob, workersFor } from "@/lib/job-access";
import { loadInspection } from "@/lib/inspection-access";
import { checkImage, readStored, saveFile } from "@/lib/storage";
import type { JobStatus } from "@/lib/options";

export type FormState = { error?: string } | undefined;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const event = (tx: Tx | typeof db, jobId: string, actorId: string, action: string, detail = "") =>
  tx.insert(schema.jobEvents).values({ jobId, actorId, action, detail });

/** Who may raise a job against a property: admins anywhere, others within their scope. */
function mayRaise(user: CurrentUser, property: { id: string; orgId: string; parentId: string | null }) {
  if (user.role === "admin" || user.role === "inspector") return property.orgId === user.orgId;
  return canSeeProperty(user, property);
}

export async function createJob(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const propertyId = str(fd, "propertyId");
  const title = str(fd, "title")?.slice(0, 120);
  const description = str(fd, "description")?.slice(0, 4000);
  const location = str(fd, "location")?.slice(0, 200);
  const priority = str(fd, "priority") as (typeof schema.jobPriorityEnum.enumValues)[number] | null;
  const itemId = str(fd, "inspectionItemId");
  if (!title || !description || !location || !priority || !schema.jobPriorityEnum.enumValues.includes(priority) || !isUuid(propertyId))
    return { error: "Complete all fields." };
  const property = await db.query.properties.findFirst({ where: eq(schema.properties.id, propertyId) });
  if (!property || !mayRaise(user, property)) return { error: "You can't raise job cards for that property." };

  // Optional link back to an inspection item (and copy its photos in as "before" evidence).
  let photos: { path: string; mimeType: string }[] = [];
  if (itemId) {
    if (!isUuid(itemId) || !canInspect(user)) return { error: "Invalid inspection item." };
    const row = await db
      .select({ section: schema.inspectionSections })
      .from(schema.inspectionItems)
      .innerJoin(schema.inspectionSections, eq(schema.inspectionSections.id, schema.inspectionItems.sectionId))
      .where(eq(schema.inspectionItems.id, itemId))
      .limit(1);
    const found = row[0] && (await loadInspection(user, row[0].section.inspectionId));
    if (!found || found.property.id !== property.id) return { error: "Invalid inspection item." };
    photos = await db.query.photos.findMany({ where: eq(schema.photos.itemId, itemId) });
  }

  const dueRaw = str(fd, "dueDate");
  const dueDate = dueRaw ? new Date(`${dueRaw}T17:00:00+02:00`) : null;

  const copied: { path: string; mimeType: string }[] = [];
  for (const p of photos) {
    try {
      copied.push({ path: await saveFile(`${user.orgId}/jobs`, await readStored(p.path), p.mimeType), mimeType: p.mimeType });
    } catch {
      /* skip missing files */
    }
  }

  const id = await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: max(schema.jobs.number) }).from(schema.jobs).where(eq(schema.jobs.orgId, user.orgId));
    const [job] = await tx
      .insert(schema.jobs)
      .values({
        orgId: user.orgId,
        number: (n ?? 1000) + 1,
        propertyId: property.id,
        location,
        title,
        description,
        priority,
        requesterId: user.id,
        dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
        inspectionItemId: itemId,
      })
      .returning();
    await event(tx, job.id, user.id, "Request submitted", itemId ? "Raised from an inspection" : "");
    if (copied.length)
      await tx.insert(schema.jobEvidence).values(copied.map((c) => ({ jobId: job.id, kind: "before" as const, path: c.path, mimeType: c.mimeType, actorId: user.id })));
    return job.id;
  });
  revalidatePath("/jobs");
  redirect(`/jobs/${id}`);
}

async function transition(
  fd: FormData,
  run: (ctx: { user: CurrentUser; job: typeof schema.jobs.$inferSelect; property: typeof schema.properties.$inferSelect }) => Promise<
    { error: string } | { set: Partial<typeof schema.jobs.$inferInsert>; action: string; detail?: string }
  >,
): Promise<FormState> {
  const user = await requireUser();
  const found = await loadJob(user, String(fd.get("id")));
  if (!found) return { error: "Job not found." };
  const res = await run({ user, ...found });
  if ("error" in res) return res;
  await db.transaction(async (tx) => {
    await tx.update(schema.jobs).set({ ...res.set, updatedAt: new Date() }).where(eq(schema.jobs.id, found.job.id));
    await event(tx, found.job.id, user.id, res.action, res.detail);
  });
  revalidatePath(`/jobs/${found.job.id}`);
  revalidatePath("/jobs");
  return {};
}

const inWork = (s: JobStatus) => s === "in_progress" || s === "returned_for_rework";

export async function allocateJob(_: FormState, fd: FormData) {
  return transition(fd, async ({ user, job, property }) => {
    if (!canManageJobs(user) || !["awaiting_approval", "returned_for_clarification"].includes(job.status))
      return { error: "Action not allowed for this role or job status." };
    const assignee = str(fd, "assigneeId");
    const workers = await workersFor(user.orgId, property);
    const w = workers.find((x) => x.id === assignee);
    if (!w) return { error: "Choose an active staff member or contractor for this property." };
    return { set: { assigneeId: w.id, status: "in_progress" }, action: "Approved and allocated", detail: w.name };
  });
}

export async function returnForClarification(_: FormState, fd: FormData) {
  return transition(fd, async ({ user, job }) => {
    if (!canManageJobs(user) || job.status !== "awaiting_approval") return { error: "Action not allowed for this role or job status." };
    const reason = str(fd, "reason")?.slice(0, 1000);
    if (!reason) return { error: "Enter what you need to know." };
    return { set: { status: "returned_for_clarification" }, action: "Returned for clarification", detail: reason };
  });
}

export async function clarifyJob(_: FormState, fd: FormData) {
  return transition(fd, async ({ user, job }) => {
    if (job.requesterId !== user.id || job.status !== "returned_for_clarification") return { error: "Action not allowed." };
    const extra = str(fd, "detail")?.slice(0, 2000);
    if (!extra) return { error: "Add the extra detail." };
    return {
      set: { status: "awaiting_approval", description: `${job.description}\n\nUpdate: ${extra}`.slice(0, 6000) },
      action: "Clarification added",
      detail: extra,
    };
  });
}

export async function saveWork(_: FormState, fd: FormData) {
  return transition(fd, async ({ user, job }) => {
    if (!(isWorker(user) && job.assigneeId === user.id && inWork(job.status))) return { error: "Action not allowed for this role or job status." };
    const minutes = Number(fd.get("workMinutes"));
    const overtime = Number(fd.get("overtimeMinutes"));
    if (![minutes, overtime].every((n) => Number.isInteger(n) && n >= 0 && n <= 60000)) return { error: "Enter valid time in minutes." };
    return { set: { workMinutes: minutes, overtimeMinutes: overtime, workNotes: (str(fd, "workNotes") ?? "").slice(0, 4000) }, action: "Work record updated" };
  });
}

export async function submitWork(_: FormState, fd: FormData) {
  return transition(fd, async ({ user, job }) => {
    if (!(isWorker(user) && job.assigneeId === user.id && inWork(job.status))) return { error: "Action not allowed for this role or job status." };
    const ev = await db.query.jobEvidence.findMany({ where: eq(schema.jobEvidence.jobId, job.id) });
    const kinds = new Set(ev.map((e) => e.kind));
    if (!(["before", "after", "contractor_signature"] as const).every((k) => kinds.has(k)))
      return { error: "Before and after photos and your signature are required." };
    return { set: { status: "awaiting_final_approval" }, action: "Work submitted for review" };
  });
}

export async function closeJob(_: FormState, fd: FormData) {
  return transition(fd, async ({ user, job }) => {
    if (!canManageJobs(user) || job.status !== "awaiting_final_approval") return { error: "Action not allowed for this role or job status." };
    const requester = await db.query.memberships.findFirst({
      where: and(eq(schema.memberships.userId, job.requesterId), eq(schema.memberships.orgId, job.orgId)),
    });
    if (requester?.role === "tenant") {
      const sig = await db.query.jobEvidence.findFirst({
        where: and(eq(schema.jobEvidence.jobId, job.id), eq(schema.jobEvidence.kind, "tenant_signature")),
      });
      if (!sig) return { error: "Tenant acknowledgement is required before closing." };
    }
    return { set: { status: "closed" }, action: "Manager approved and closed" };
  });
}

export async function returnForRework(_: FormState, fd: FormData) {
  return transition(fd, async ({ user, job }) => {
    if (!canManageJobs(user) || job.status !== "awaiting_final_approval") return { error: "Action not allowed for this role or job status." };
    const reason = str(fd, "reason")?.slice(0, 1000);
    if (!reason) return { error: "Enter a reason." };
    return { set: { status: "returned_for_rework" }, action: "Returned for rework", detail: reason };
  });
}

/** Photo or signature upload. Signatures arrive as PNG blobs from the signature pad. */
export async function addEvidence(fd: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const found = await loadJob(user, String(fd.get("id")));
  if (!found) return { error: "Job not found." };
  const { job } = found;
  const kind = String(fd.get("kind")) as (typeof schema.evidenceKindEnum.enumValues)[number];
  const worker = isWorker(user) && job.assigneeId === user.id && inWork(job.status);
  const tenant = user.role === "tenant" && job.requesterId === user.id && job.status === "awaiting_final_approval";
  if (!((worker && ["before", "after", "contractor_signature"].includes(kind)) || (tenant && kind === "tenant_signature")))
    return { error: "Action not allowed." };
  const file = fd.get("file");
  const bad = checkImage(file);
  if (bad) return { error: bad };
  const f = file as File;
  const path = await saveFile(`${user.orgId}/jobs/${job.id}`, Buffer.from(await f.arrayBuffer()), f.type);
  await db.transaction(async (tx) => {
    await tx.insert(schema.jobEvidence).values({ jobId: job.id, kind, path, mimeType: f.type, actorId: user.id });
    await event(tx, job.id, user.id, "Evidence added", kind.replace("_", " "));
    await tx.update(schema.jobs).set({ updatedAt: new Date() }).where(eq(schema.jobs.id, job.id));
  });
  revalidatePath(`/jobs/${job.id}`);
  return {};
}
