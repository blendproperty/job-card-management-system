import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Camera, CheckCircle2, Clock, Lock, MapPin, PenLine, UserCheck, UserPlus } from "lucide-react";
import { Card, EngineerChip, OutcomeBadge, StatusPill } from "@/components/ui";
import { requireOffice } from "@/server/auth";
import { getJob, listMembers, NotFound } from "@/server/repo";
import { STAGE_LABEL } from "@/server/stages";
import type { JobDetail } from "@/server/types";
import { fmtDayTime, fmtDuration, fmtSlot, fmtTime, isOverdue } from "@/lib/format";
import { AssignForm } from "./assign-form";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "Job" };

/** S05 Job detail. */
export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const me = await requireOffice();
  const { id } = await params;
  let job: JobDetail;
  try {
    job = await getJob(me, id);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    throw e;
  }
  const { created } = await searchParams;
  const people = job.locked_at ? [] : await listMembers(me, { field: true });
  const photos = job.attachments.filter((a) => a.kind === "photo");
  const signature = job.attachments.find((a) => a.kind === "signature");
  const overdue = isOverdue(job.stage, job.scheduled_end);
  const live = !job.locked_at && job.stage !== "unassigned";
  const followUps = job.events
    .filter((e) => (e.payload as { follow_up_requested?: boolean } | null)?.follow_up_requested)
    .map((e) => ({ member_name: e.member_name, note: (e.payload as { note?: string | null }).note ?? null, at: e.occurred_at }));

  return (
    <div className="flex flex-col gap-5">
      {live && <AutoRefresh seconds={10} />}
      <Link href="/jobs" className="inline-flex w-fit items-center gap-1 font-semibold text-accent-text hover:underline">
        <ArrowLeft aria-hidden className="size-4" />Jobs
      </Link>
      {created && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-accent-soft p-3 text-text">
          <CheckCircle2 aria-hidden className="size-4 text-accent-text" />Job {job.number} created{job.assignees.length ? ` and sent to ${job.assignees[0].display_name}` : ""}.
        </p>
      )}

      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-text-muted">JOB {job.number}</p>
          <h1 className="text-xl font-bold break-words">{job.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill stage={job.stage} />
          {job.resolution && <OutcomeBadge name={job.resolution.name} successful={job.resolution.successful} />}
          {overdue && <StatusPill stage="overdue" />}
          {job.locked_at && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted"><Lock aria-hidden className="size-3.5" />Locked</span>
          )}
        </div>
      </header>

      {job.resolution && (
        <section aria-label="Outcome" className={"rounded-lg border p-4 " + (job.resolution.successful ? "border-border bg-bg" : "border-danger/30 bg-danger-soft")}>
          <p className="font-semibold">
            {job.resolution.successful ? "Done: " : "Couldn't finish: "}{job.resolution.name}
          </p>
          {job.resolution_comment && <p className="mt-1 whitespace-pre-wrap text-text">{job.resolution_comment}</p>}
          {followUps.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 font-semibold text-accent-text">
              <CalendarPlus aria-hidden className="size-4" />
              {followUps[0].member_name ?? "The engineer"} asked for a follow-up visit{followUps[0].note ? `: "${followUps[0].note}"` : "."}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <Card>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact icon={<MapPin />} term="Site">
                {job.site.label}<span className="block text-xs text-text-muted">{job.site.address}</span>
              </Fact>
              <Fact icon={<UserCheck />} term="Client">{job.client.name}</Fact>
              <Fact icon={<Clock />} term="Slot">{fmtSlot(job.scheduled_start, job.scheduled_end)}</Fact>
              <Fact icon={<Clock />} term="Time on site">
                {job.on_site_seconds !== null ? fmtDuration(job.on_site_seconds) : job.arrived_at ? `Since ${fmtTime(job.arrived_at)}` : "Not arrived yet"}
                {job.estimate_min && <span className="block text-xs text-text-muted">Estimate {fmtDuration(job.estimate_min * 60)}</span>}
              </Fact>
            </dl>
            {job.description && <p className="mt-4 border-t border-border pt-4 whitespace-pre-wrap">{job.description}</p>}
            {job.site.access_notes && (
              <p className="mt-4 rounded-sm bg-surface p-3 text-text-muted"><span className="font-semibold text-text">Access: </span>{job.site.access_notes}</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><Camera aria-hidden className="size-4" />Photos</h2>
            {photos.length === 0 ? (
              <p className="text-text-muted">No photos yet. They appear here as the engineer takes them.</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                {photos.map((p, i) => (
                  <li key={p.id} className="overflow-hidden rounded-md border border-border">
                    {p.uploaded_at && p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url!} alt={`${p.stage} photo ${i + 1}, ${fmtTime(p.taken_at)}`} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="grid aspect-square place-items-center bg-surface-2 p-2 text-center text-xs text-text-muted">Uploading from the phone…</div>
                    )}
                    <p className="px-2 py-1 text-xs text-text-muted capitalize">{p.stage} · {fmtTime(p.taken_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><PenLine aria-hidden className="size-4" />Customer signature</h2>
            {!signature ? (
              <p className="text-text-muted">Not signed yet.</p>
            ) : (
              <figure>
                {signature.uploaded_at && signature.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signature.url!} alt={`Signature of ${signature.signer_name ?? "customer"}`} className="h-32 w-full max-w-md rounded-md border border-border bg-bg object-contain" />
                ) : (
                  <div className="grid h-32 max-w-md place-items-center rounded-md bg-surface-2 text-xs text-text-muted">Uploading from the phone…</div>
                )}
                <figcaption className="mt-2 text-text-muted">Signed by <span className="font-semibold text-text">{signature.signer_name ?? "customer"}</span> at {fmtDayTime(signature.taken_at)}</figcaption>
              </figure>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><UserPlus aria-hidden className="size-4" />Assigned</h2>
            {job.assignees.length > 0 && (
              <ul className="mb-3 flex flex-col gap-2">{job.assignees.map((a) => <li key={a.id}><EngineerChip name={a.display_name} /></li>)}</ul>
            )}
            {!job.locked_at ? (
              <AssignForm jobId={job.id} current={job.assignees[0]?.id} people={people.map((p) => ({ id: p.id, name: p.display_name }))} />
            ) : job.assignees.length === 0 ? (
              <p className="text-text-muted">Nobody.</p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold">Timeline</h2>
            <ol className="flex flex-col gap-3">
              <TimelineRow at={job.created_at} text="Job created" />
              {job.events.filter((e) => e.kind !== "note" || (e.payload as { follow_up_requested?: boolean } | null)?.follow_up_requested).map((e) => {
                const p = (e.payload ?? {}) as { resolution_name?: string; follow_up_requested?: boolean };
                const who = e.member_name ?? "Someone";
                const text = e.kind === "assign" ? `${who} assigned the job`
                  : p.follow_up_requested ? `${who} asked for a follow-up visit`
                  : e.to_stage === "completed" && p.resolution_name ? `${who} finished the job: ${p.resolution_name}`
                  : `${who} marked ${STAGE_LABEL[e.to_stage!]}`;
                return (
                  <TimelineRow key={e.id} at={e.occurred_at} text={text}
                    late={Date.parse(e.received_at) - Date.parse(e.occurred_at) > 120_000 ? e.received_at : null} />
                );
              })}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon, term, children }: { icon: React.ReactNode; term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden className="mt-0.5 text-text-subtle [&_svg]:size-4">{icon}</span>
      <div><dt className="text-xs font-semibold text-text-muted">{term}</dt><dd>{children}</dd></div>
    </div>
  );
}

function TimelineRow({ at, text, late }: { at: string; text: string; late?: string | null }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-text" />
      <div>
        <p>{text}</p>
        <p className="text-xs text-text-muted">
          <time dateTime={at}>{fmtDayTime(at)}</time>
          {late && <> · recorded offline, synced {fmtTime(late)}</>}
        </p>
      </div>
    </li>
  );
}
