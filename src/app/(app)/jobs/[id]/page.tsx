import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageJobs, canViewInspections, isWorker } from "@/lib/permissions";
import { loadJob, workersFor } from "@/lib/job-access";
import { addressOneLine, fmtDate, fmtDateTime } from "@/lib/format";
import { EVIDENCE_KINDS } from "@/lib/options";
import { PageHeader } from "@/components/page-header";
import { JobStatusBadge, PriorityBadge } from "@/components/badges";
import { ManagerApprove, ManagerReview, PhotoUpload, RequesterClarify, SignEvidence, SubmitWork, WorkRecord } from "./controls";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const found = await loadJob(user, id);
  if (!found) notFound();
  const { job, property } = found;
  const [evidence, events, requester, assignee, workers, requesterMembership, source] = await Promise.all([
    db.query.jobEvidence.findMany({ where: eq(schema.jobEvidence.jobId, id), orderBy: asc(schema.jobEvidence.createdAt) }),
    db
      .select({ e: schema.jobEvents, actor: schema.users.name })
      .from(schema.jobEvents)
      .leftJoin(schema.users, eq(schema.users.id, schema.jobEvents.actorId))
      .where(eq(schema.jobEvents.jobId, id))
      .orderBy(desc(schema.jobEvents.createdAt)),
    db.query.users.findFirst({ where: eq(schema.users.id, job.requesterId) }),
    job.assigneeId ? db.query.users.findFirst({ where: eq(schema.users.id, job.assigneeId) }) : null,
    canManageJobs(user) ? workersFor(user.orgId, property) : [],
    db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, job.requesterId), eq(schema.memberships.orgId, job.orgId)) }),
    job.inspectionItemId && canViewInspections(user)
      ? db
          .select({ inspectionId: schema.inspectionSections.inspectionId })
          .from(schema.inspectionItems)
          .innerJoin(schema.inspectionSections, eq(schema.inspectionSections.id, schema.inspectionItems.sectionId))
          .where(eq(schema.inspectionItems.id, job.inspectionItemId))
          .limit(1)
      : [],
  ]);

  const manager = canManageJobs(user);
  const worker = isWorker(user) && job.assigneeId === user.id;
  const inWork = job.status === "in_progress" || job.status === "returned_for_rework";
  const kinds = new Set(evidence.map((e) => e.kind));
  const lastReturn = events.find(({ e }) => e.action === "Returned for rework" || e.action === "Returned for clarification");

  return (
    <>
      <PageHeader
        title={job.title}
        subtitle={<>JC-{job.number} · <Link href={`/properties/${property.id}`} className="text-brand-700 hover:underline">{addressOneLine(property)}</Link> · {job.location}</>}
        back={{ href: "/jobs", label: "Job cards" }}
        actions={<><PriorityBadge priority={job.priority} /><JobStatusBadge status={job.status} /></>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-2 font-semibold">Reported issue</h2>
            <p className="text-sm whitespace-pre-wrap text-stone-700">{job.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-stone-500">Requested by</dt><dd>{requester?.name}</dd></div>
              <div><dt className="text-xs text-stone-500">Assigned to</dt><dd>{assignee?.name ?? "Unassigned"}</dd></div>
              <div><dt className="text-xs text-stone-500">Raised</dt><dd>{fmtDate(job.createdAt)}</dd></div>
              <div><dt className="text-xs text-stone-500">Needed by</dt><dd>{fmtDate(job.dueDate)}</dd></div>
              {(job.workMinutes > 0 || job.overtimeMinutes > 0) && (
                <>
                  <div><dt className="text-xs text-stone-500">Work time</dt><dd>{job.workMinutes} min</dd></div>
                  <div><dt className="text-xs text-stone-500">Overtime</dt><dd>{job.overtimeMinutes} min</dd></div>
                </>
              )}
            </dl>
            {source[0] && (
              <p className="mt-4 text-sm"><Link href={`/inspections/${source[0].inspectionId}`} className="text-brand-700 hover:underline">View the inspection this came from</Link></p>
            )}
            {job.workNotes && (
              <div className="mt-4 rounded-lg bg-stone-50 p-3 text-sm"><p className="text-xs text-stone-500">Work completed</p><p className="whitespace-pre-wrap">{job.workNotes}</p></div>
            )}
            {lastReturn && job.status.startsWith("returned") && (
              <div className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-900"><p className="text-xs font-semibold">{lastReturn.e.action}</p><p>{lastReturn.e.detail}</p></div>
            )}
          </section>

          {/* Next step for this person */}
          {manager && ["awaiting_approval", "returned_for_clarification"].includes(job.status) && (
            <section className="card p-5"><h2 className="mb-3 font-semibold">Approve this request</h2><ManagerApprove id={job.id} workers={workers} /></section>
          )}
          {job.requesterId === user.id && job.status === "returned_for_clarification" && (
            <section className="card p-5"><RequesterClarify id={job.id} /></section>
          )}
          {worker && inWork && (
            <section className="card space-y-5 p-5">
              <h2 className="font-semibold">Work record</h2>
              <WorkRecord id={job.id} minutes={job.workMinutes} overtime={job.overtimeMinutes} notes={job.workNotes} />
              <div className="grid gap-3 sm:grid-cols-2">
                <PhotoUpload id={job.id} kind="before" label={`Before photos${kinds.has("before") ? " ✓" : ""}`} />
                <PhotoUpload id={job.id} kind="after" label={`After photos${kinds.has("after") ? " ✓" : ""}`} />
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <SignEvidence id={job.id} kind="contractor_signature" label={kinds.has("contractor_signature") ? "Sign again" : "Sign as contractor / staff"} />
                <SubmitWork id={job.id} />
              </div>
              <p className="text-xs text-stone-500">Before and after photos and your signature are needed to submit.</p>
            </section>
          )}
          {user.role === "tenant" && job.requesterId === user.id && job.status === "awaiting_final_approval" && (
            <section className="card p-5">
              <h2 className="mb-1 font-semibold">Confirm the work is done</h2>
              <p className="mb-3 text-sm text-stone-500">Your signature tells the manager you&apos;re happy with the repair.</p>
              <SignEvidence id={job.id} kind="tenant_signature" label={kinds.has("tenant_signature") ? "Signed ✓ · sign again" : "Sign acknowledgement"} />
            </section>
          )}
          {manager && job.status === "awaiting_final_approval" && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Review the work</h2>
              {requesterMembership?.role === "tenant" && !kinds.has("tenant_signature") && (
                <p className="mb-3 text-sm text-amber-700">Waiting for the tenant to sign before this can be closed.</p>
              )}
              <ManagerReview id={job.id} />
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Photos and signatures</h2>
            {evidence.length === 0 ? (
              <p className="text-sm text-stone-500">No evidence added yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {evidence.map((e) => (
                  <li key={e.id} className="w-32">
                    <a href={`/api/files/evidence/${e.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/evidence/${e.id}`} alt={EVIDENCE_KINDS[e.kind]} className={`h-24 w-32 rounded-lg border border-stone-200 ${e.kind.endsWith("signature") ? "object-contain" : "object-cover"}`} />
                    </a>
                    <p className="mt-1 text-xs text-stone-500">{EVIDENCE_KINDS[e.kind]}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card self-start p-5">
          <h2 className="mb-3 font-semibold">Activity</h2>
          <ol className="space-y-4 border-l-2 border-brand-100 pl-4">
            {events.map(({ e, actor }) => (
              <li key={e.id}>
                <p className="text-sm font-medium">{e.action}</p>
                <p className="text-xs text-stone-500">{actor ?? "Someone"} · {fmtDateTime(e.createdAt)}</p>
                {e.detail && <p className="mt-1 text-sm text-stone-600">{e.detail}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
