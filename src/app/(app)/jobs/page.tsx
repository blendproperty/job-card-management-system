import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listJobs } from "@/lib/job-list";
import { addressOneLine, fmtDate } from "@/lib/format";
import { JOB_PRIORITIES, JOB_STATUSES } from "@/lib/options";
import { EmptyState, PageHeader } from "@/components/page-header";
import { JobStatusBadge, PriorityBadge } from "@/components/badges";

export const metadata = { title: "Job cards" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; priority?: string }> }) {
  const f = await searchParams;
  const status = f.status ?? "open";
  const user = await requireUser();
  const rows = await listJobs(user, { ...f, status: status === "all" ? undefined : status });
  return (
    <>
      <PageHeader
        title="Job cards"
        subtitle="Maintenance requests, from report to sign-off."
        actions={<Link href="/jobs/new" className="btn-primary"><Plus className="h-4 w-4" /> New request</Link>}
      />
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-4" method="get">
        <input name="q" defaultValue={f.q} placeholder="Search title, location, property…" className="input sm:col-span-2" />
        <select name="status" defaultValue={status} className="input">
          <option value="open">All open</option>
          <option value="all">Everything</option>
          {Object.entries(JOB_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="priority" defaultValue={f.priority ?? ""} className="input">
            <option value="">Any priority</option>
            {Object.entries(JOB_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-primary">Apply</button>
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No job cards here" body="Report an issue to start a job card, or raise one straight from an inspection item." action={<Link href="/jobs/new" className="btn-primary">New request</Link>} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Job</th><th>Property</th><th>Priority</th><th>Assigned to</th><th>Updated</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(({ job, property, assignee }) => (
                <tr key={job.id} className="hover:bg-stone-50">
                  <td className="min-w-56">
                    <Link href={`/jobs/${job.id}`} className="font-medium hover:text-brand-700 hover:underline">{job.title}</Link>
                    <div className="text-xs text-stone-500">JC-{job.number} · {job.location}</div>
                  </td>
                  <td className="min-w-48 text-stone-600">{addressOneLine(property)}</td>
                  <td><PriorityBadge priority={job.priority} /></td>
                  <td className="text-stone-600">{assignee ?? "Unassigned"}</td>
                  <td className="whitespace-nowrap text-stone-600">{fmtDate(job.updatedAt)}</td>
                  <td><JobStatusBadge status={job.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
