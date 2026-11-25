import Link from "next/link";
import { Inbox, Plus, SearchX } from "lucide-react";
import { ButtonLink, EmptyState, EngineerChip, OutcomeBadge, StatusPill, TabLinks } from "@/components/ui";
import { requireOffice } from "@/server/auth";
import { listJobs, type JobTab } from "@/server/repo";
import { fmtSlot, isOverdue } from "@/lib/format";

export const metadata = { title: "Jobs" };

const TABS: { key: JobTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
];

const EMPTY: Record<JobTab, { title: string; hint: string }> = {
  all: { title: "No jobs yet", hint: "Create the first one and assign it to someone in the field." },
  unassigned: { title: "Nothing waiting", hint: "New jobs land here until someone takes them." },
  assigned: { title: "No assigned jobs", hint: "Jobs show here once they have someone but haven't started." },
  in_progress: { title: "Nobody's on a job right now", hint: "Jobs move here when the engineer heads out." },
  pending: { title: "Nothing on hold", hint: "Jobs paused for parts or access show here." },
  completed: { title: "No completed jobs", hint: "Finished jobs, with photos and signatures, collect here." },
};

/** S03 Jobs grid. */
export default async function JobsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const me = await requireOffice();
  const sp = await searchParams;
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "all") as JobTab;
  const q = sp.q ?? "";
  const { jobs, counts } = await listJobs(me, tab, q);
  const qs = (t: string) => `/jobs?${new URLSearchParams({ ...(t !== "all" && { tab: t }), ...(q && { q }) })}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-bold">Jobs</h1>
        {q && (
          <p className="text-text-muted">
            Matching &ldquo;{q}&rdquo; · <Link href={tab === "all" ? "/jobs" : `/jobs?tab=${tab}`} className="font-semibold text-accent-text hover:underline">Clear search</Link>
          </p>
        )}
      </div>
      <TabLinks label="Job status" current={tab} tabs={TABS.map((t) => ({ ...t, count: counts[t.key], href: qs(t.key) }))} />

      <div className="mt-4">
        {jobs.length === 0 ? (
          q ? (
            <EmptyState icon={<SearchX />} title="No jobs match" hint="Try a job number, street, unit or property owner name." />
          ) : (
            <EmptyState icon={<Inbox />} {...EMPTY[tab]}
              action={tab === "all" || tab === "unassigned" ? <ButtonLink href="/jobs/new"><Plus aria-hidden />New job</ButtonLink> : undefined} />
          )
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-bg">
            <table className="w-full border-collapse">
              <caption className="sr-only">Jobs, {TABS.find((t) => t.key === tab)!.label.toLowerCase()}</caption>
              <thead>
                <tr className="text-left text-xs font-semibold text-text-muted">
                  {["Job", "Title", "Site", "Assigned", "Slot", "Status", "Outcome"].map((h) => (
                    <th key={h} scope="col" className="border-b border-border px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const overdue = isOverdue(j.stage, j.scheduled_end);
                  return (
                    <tr key={j.id} className="hover:bg-surface">
                      <td className={"border-b border-border px-3 py-2.5 " + (overdue ? "shadow-[inset_3px_0_0_var(--color-danger)]" : "")}>
                        <Link href={`/jobs/${j.id}`} className="font-semibold text-accent-text hover:underline">{j.number}</Link>
                      </td>
                      <td className="max-w-[28ch] truncate border-b border-border px-3 py-2.5" title={j.title}>{j.title}</td>
                      <td className="border-b border-border px-3 py-2.5">
                        <span className="block max-w-[26ch] truncate">{j.site.label}</span>
                        <span className="block max-w-[26ch] truncate text-xs text-text-muted">{j.client.name}</span>
                      </td>
                      <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                        {j.assignees.length ? <EngineerChip name={j.assignees[0].display_name} /> : <span className="text-text-muted">Nobody yet</span>}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">{fmtSlot(j.scheduled_start, j.scheduled_end)}</td>
                      <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex gap-1.5"><StatusPill stage={j.stage} />{overdue && <StatusPill stage="overdue" />}</span>
                      </td>
                      <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                        {j.resolution ? <OutcomeBadge name={j.resolution.name} successful={j.resolution.successful} comment={j.resolution_comment} /> : <span className="text-text-subtle" aria-label="No outcome yet">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
