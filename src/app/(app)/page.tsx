import Link from "next/link";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { ClipboardPlus, Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { canInspect, canViewInspections, propertyScope } from "@/lib/permissions";
import { listJobs } from "@/lib/job-list";
import { addressOneLine, fmtDateTime } from "@/lib/format";
import { INSPECTION_TYPES, ROLES } from "@/lib/options";
import { InspectionStatusBadge, JobStatusBadge } from "@/components/badges";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const user = await requireUser();
  const jobs = await listJobs(user);
  const showInspections = canViewInspections(user);
  const startOfToday = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }) + "T00:00:00+02:00");
  const upcoming = showInspections
    ? await db
        .select({ i: schema.inspections, property: schema.properties })
        .from(schema.inspections)
        .innerJoin(schema.properties, eq(schema.properties.id, schema.inspections.propertyId))
        .where(
          and(
            eq(schema.inspections.orgId, user.orgId),
            propertyScope(user),
            inArray(schema.inspections.status, ["scheduled", "in_progress", "in_review"]),
            user.role === "inspector" ? eq(schema.inspections.inspectorId, user.id) : undefined,
            gte(schema.inspections.scheduledAt, new Date(startOfToday.getTime() - 30 * 864e5)),
          ),
        )
        .orderBy(asc(schema.inspections.scheduledAt))
        .limit(8)
    : [];

  const count = (s: string[]) => jobs.filter(({ job }) => s.includes(job.status)).length;
  const stats = [
    { label: "Open jobs", n: jobs.filter(({ job }) => job.status !== "closed").length, href: "/jobs" },
    { label: "Awaiting approval", n: count(["awaiting_approval", "returned_for_clarification"]), href: "/jobs?status=awaiting_approval" },
    { label: "In progress", n: count(["in_progress", "returned_for_rework"]), href: "/jobs?status=in_progress" },
    { label: "Ready for review", n: count(["awaiting_final_approval"]), href: "/jobs?status=awaiting_final_approval" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.13em] text-brand-600 uppercase">{user.orgName}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Good to see you, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-stone-500">{ROLES[user.role]} · your workspace at a glance.</p>
        </div>
        <div className="flex gap-2">
          {canInspect(user) && <Link href="/inspections/new" className="btn-secondary"><ClipboardPlus className="h-4 w-4" /> New inspection</Link>}
          <Link href="/jobs/new" className="btn-primary"><Plus className="h-4 w-4" /> New request</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:border-brand-500">
            <p className="text-sm text-stone-500">{s.label}</p>
            <p className="mt-2 text-3xl font-bold">{s.n}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {showInspections && (
          <section className="card">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
              <h2 className="font-semibold">Upcoming and open inspections</h2>
              <Link href="/inspections" className="text-sm text-brand-700 hover:underline">All</Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="px-5 py-6 text-sm text-stone-500">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {upcoming.map(({ i, property }) => (
                  <li key={i.id}>
                    <Link href={`/inspections/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{addressOneLine(property)}</p>
                        <p className="text-xs text-stone-500">{INSPECTION_TYPES[i.type]} · {fmtDateTime(i.scheduledAt)}</p>
                      </div>
                      <InspectionStatusBadge status={i.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section className={`card ${showInspections ? "" : "lg:col-span-2"}`}>
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
            <h2 className="font-semibold">Recent job cards</h2>
            <Link href="/jobs" className="text-sm text-brand-700 hover:underline">All</Link>
          </div>
          {jobs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-stone-500">No job cards yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {jobs.slice(0, 8).map(({ job, property }) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job.title}</p>
                      <p className="truncate text-xs text-stone-500">JC-{job.number} · {property.addressLine1} · {job.location}</p>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
