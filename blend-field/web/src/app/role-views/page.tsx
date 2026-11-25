import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Card } from "@/components/ui";

const roles = {
  tenant: { label: "Tenant", title: "My maintenance", subtitle: "Log and track requests for your property.", open: "/requests", cta: "Open tenant portal" },
  trade: { label: "Contractor", title: "My field jobs", subtitle: "See your allocated work and capture updates on site.", open: "https://jobcards-field.srv938083.hstgr.cloud/", cta: "Open contractor portal" },
  manager: { label: "PM / AM / FM", title: "Job management", subtitle: "Review tenant requests, allocate work and approve closure.", open: "/jobs", cta: "Open manager workspace" },
} as const;

export const metadata = { title: "Role views" };

export default async function RoleViews({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const key = (await searchParams).view ?? "tenant";
  if (!Object.hasOwn(roles, key)) notFound();
  const role = roles[key as keyof typeof roles];
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-7">
      <header>
        <p className="font-semibold text-accent-text">Blend Job Cards</p>
        <h1 className="text-2xl font-bold">Role views</h1>
        <p className="text-text-muted">Read-only preview with sample information. Open a workspace to sign in and work in that role.</p>
      </header>
      <nav aria-label="Choose a role" className="flex flex-wrap gap-2">
        {Object.entries(roles).map(([id, option]) => (
          <ButtonLink key={id} href={`/role-views?view=${id}`} variant={id === key ? "primary" : "secondary"} aria-current={id === key ? "page" : undefined}>
            {option.label}
          </ButtonLink>
        ))}
      </nav>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">{role.title}</h2><p className="text-text-muted">{role.subtitle}</p></div>
          {key === "trade" ? <a href={role.open} className="font-semibold text-accent-text underline">{role.cta}</a> :
            <ButtonLink href={role.open}>{role.cta}</ButtonLink>}
        </div>
        {key === "tenant" && <>
          <div className="grid gap-2 rounded-md bg-surface p-4 sm:grid-cols-2">
            <div><p className="text-sm text-text-muted">Requested by</p><p className="font-semibold">Sam Demo</p><p>Example Tenant Co.</p></div>
            <div><p className="text-sm text-text-muted">Contact</p><p>sam@example.test</p><p>+27 00 000 0000</p></div>
          </div>
          <h3 className="font-semibold">My requests</h3>
          <p>#1001 · Inspect the corridor lights <span className="font-semibold">· Awaiting approval</span></p>
          <p>#1000 · Repair the leaking geyser <span className="font-semibold">· Closed</span></p>
        </>}
        {key === "trade" && <div className="space-y-3 rounded-md bg-surface p-4">
          <h3 className="font-semibold">Assigned to me</h3>
          <p>Repair the leaking geyser · Showcase Building, Unit 101</p>
          <p className="text-sm text-text-muted">Field progress: En route → Arrived → In progress → Submit work</p>
          <p className="text-sm">Work photos, tenant signature, time and contractor sign-off are captured in the job.</p>
        </div>}
        {key === "manager" && <div className="space-y-3 rounded-md bg-surface p-4">
          <h3 className="font-semibold">Approvals and closure</h3>
          <div className="flex flex-wrap justify-between gap-2"><Link href="/jobs/d0cbc95b-5b5f-4881-b432-d6383d1ac627" className="text-accent-text underline">#1001 · Inspect the corridor lights</Link><span>Awaiting approval</span></div>
          <div className="flex flex-wrap justify-between gap-2"><Link href="/jobs/c41a9df9-bee9-446d-ac33-34466d0df60b" className="text-accent-text underline">#1000 · Repair the leaking geyser</Link><span>Closed · Overtime approved</span></div>
        </div>}
      </Card>
    </main>
  );
}
