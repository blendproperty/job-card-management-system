import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listJobs } from "@/lib/job-list";
import { JOB_STATUSES, type JobStatus } from "@/lib/options";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge } from "@/components/badges";

export const metadata = { title: "Work board" };

const COLUMNS: JobStatus[] = ["awaiting_approval", "in_progress", "returned_for_rework", "awaiting_final_approval", "closed"];

export default async function BoardPage() {
  const user = await requireUser();
  const rows = await listJobs(user);
  return (
    <>
      <PageHeader title="Work board" subtitle="Every job card you can see, by stage." />
      <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((s) => {
          const jobs = rows.filter(({ job }) => job.status === s || (s === "awaiting_approval" && job.status === "returned_for_clarification"));
          return (
            <section key={s} className="min-h-56 rounded-xl bg-[#e8efeb] p-3">
              <h2 className="mb-2 flex justify-between px-1 text-sm font-semibold">{JOB_STATUSES[s]}<span className="text-stone-500">{jobs.length}</span></h2>
              <div className="space-y-2">
                {jobs.slice(0, s === "closed" ? 15 : undefined).map(({ job, property }) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-lg border border-[#d9e6df] bg-white p-3 hover:border-brand-500">
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-500">JC-{job.number}<PriorityBadge priority={job.priority} /></div>
                    <p className="mt-1.5 text-sm font-medium">{job.title}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{property.addressLine1} · {job.location}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
