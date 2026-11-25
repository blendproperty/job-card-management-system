import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Field, Input, Select, StatusPill } from "@/components/ui";
import { fmtDayTime, fmtDuration, fmtSlot, isOverdue } from "@/lib/format";
import { requireOffice, type Actor } from "@/server/auth";
import { listJobs, listMembers, listSitesForPicker } from "@/server/repo";
import { workspaceAction } from "../../workspace-actions";

const titles: Record<string, string> = {
  map: "Field locations", schedule: "Schedule", clients: "Clients and properties", assets: "Asset register",
  invoices: "Invoices", reports: "Job reports", settings: "Team and integrations",
};
const trades = ["General maintenance", "Plumbing", "Electrical", "Other"];
const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", dateStyle: "short" });
const record = "flex flex-wrap items-start justify-between gap-2 py-3";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  return { title: titles[(await params).section] ?? "Not found" };
}

function JobLink({ id, number, title }: { id: string; number: number; title: string }) {
  return <Link href={`/jobs/${id}`} className="font-semibold text-accent-text hover:underline">#{number} · {title}</Link>;
}

async function Schedule({ actor, selected }: { actor: Actor; selected?: string }) {
  const { jobs } = await listJobs(actor);
  const shown = jobs.filter((job) => job.scheduled_start && (!selected || day.format(new Date(job.scheduled_start)) === selected));
  const unscheduled = jobs.filter((job) => !job.scheduled_start && job.stage !== "completed");
  const editable = jobs.filter((job) => !job.locked_at && job.approval !== "rejected");
  return <>
    <Card>
      <form className="flex flex-wrap items-end gap-3">
        <Field label="Filter by date" htmlFor="date"><Input id="date" type="date" name="date" defaultValue={selected} /></Field>
        <Button variant="secondary">Filter</Button><Link href="/schedule" className="self-center underline">All dates</Link>
      </form>
      <ul className="divide-y divide-border">{shown.map((job) => <li key={job.id} className={record}>
        <div><JobLink {...job} /><p>{job.site.label} · {job.assignees.map((a) => a.display_name).join(", ") || "Unassigned"}</p></div>
        <div>{fmtSlot(job.scheduled_start, job.scheduled_end)} <StatusPill stage={job.stage} /></div>
      </li>)}</ul>
      {shown.length === 0 && <p className="mt-3">No visits scheduled for this view.</p>}
    </Card>
    <Card>
      <h2 className="font-semibold">Unscheduled jobs</h2>
      <ul className="divide-y divide-border">{unscheduled.map((job) => <li className={record} key={job.id}><JobLink {...job} /></li>)}</ul>
      {unscheduled.length === 0 && <p>All open jobs have a time slot.</p>}
    </Card>
    <Card>
      <h2 className="mb-3 font-semibold">Set or change a time slot</h2>
      {editable.length ? <form action={workspaceAction.bind(null, "schedule")} className="grid gap-3 sm:grid-cols-2">
        <Field label="Job" htmlFor="job"><Select id="job" name="job" required defaultValue=""><option value="" disabled>Choose a job</option>
          {editable.map((job) => <option value={job.id} key={job.id}>#{job.number} · {job.title}</option>)}
        </Select></Field>
        <Field label="Start (SAST)" htmlFor="start"><Input type="datetime-local" id="start" name="start" required /></Field>
        <Field label="End (SAST)" htmlFor="end"><Input type="datetime-local" id="end" name="end" required /></Field>
        <Button className="self-end">Save time slot</Button>
      </form> : <p>Create an open job to schedule it.</p>}
    </Card>
  </>;
}

async function Clients({ actor }: { actor: Actor }) {
  const [clients, sites] = await Promise.all([
    actor.db.from("clients").select("id, name, billing_email").eq("org_id", actor.org_id).order("name"),
    listSitesForPicker(actor),
  ]);
  if (clients.error) throw new Error("Could not load clients.");
  return <>
    <Card>
      <h2 className="font-semibold">Portfolio</h2>
      <ul className="divide-y divide-border">{clients.data.map((client) => <li key={client.id} className="py-3">
        <p className="font-semibold">{client.name}</p>{client.billing_email && <p>{client.billing_email}</p>}
        <ul>{sites.filter((s) => s.client_id === client.id).map((s) => <li className="mt-1" key={s.id}>{s.label} · {s.address}</li>)}</ul>
      </li>)}</ul>
      {clients.data.length === 0 && <p>No clients yet.</p>}
    </Card>
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Add client</h2>
        <form action={workspaceAction.bind(null, "clients")} className="mt-3 grid gap-3">
          <input type="hidden" name="kind" value="client" />
          <Field label="Client name" htmlFor="client-name"><Input id="client-name" name="name" maxLength={120} required /></Field>
          <Button>Add client</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Add property or unit</h2>
        <form action={workspaceAction.bind(null, "clients")} className="mt-3 grid gap-3">
          <Field label="Client" htmlFor="client"><Select id="client" name="client" required defaultValue=""><option value="" disabled>Choose a client</option>
            {clients.data.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
          </Select></Field>
          <Field label="Property or unit name" htmlFor="property-name"><Input id="property-name" name="name" maxLength={120} required /></Field>
          <Field label="Address" htmlFor="address"><Input id="address" name="address" maxLength={280} required /></Field>
          <Button disabled={!clients.data.length}>Add property</Button>
        </form>
      </Card>
    </div>
  </>;
}

async function Assets({ actor }: { actor: Actor }) {
  const [result, sites] = await Promise.all([
    actor.db.from("assets").select("id, type, make, model, serial, site:sites(label), ppm_schedules(next_due,active)").eq("org_id", actor.org_id).order("type"),
    listSitesForPicker(actor),
  ]);
  if (result.error) throw new Error("Could not load assets.");
  return <>
    <Card>
      <h2 className="font-semibold">Registered equipment</h2>
      <ul className="divide-y divide-border">{result.data.map((a) => <li key={a.id} className={record}>
        <div><p className="font-semibold">{a.type} · {a.site?.label}</p><p>{[a.make, a.model, a.serial].filter(Boolean).join(" · ")}</p></div>
        <p>{a.ppm_schedules.filter((p) => p.active).map((p) => p.next_due).sort()[0] ?? "No service date recorded"}</p>
      </li>)}</ul>
      {result.data.length === 0 && <p>No assets registered.</p>}
    </Card>
    <Card>
      <h2 className="mb-3 font-semibold">Register asset</h2>
      <form action={workspaceAction.bind(null, "assets")} className="grid gap-3 sm:grid-cols-2">
        <Field label="Property" htmlFor="site"><Select id="site" name="site" required defaultValue=""><option value="" disabled>Choose a property</option>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.label}</option>)}
        </Select></Field>
        <Field label="Asset type" htmlFor="type"><Input id="type" name="type" placeholder="e.g. Geyser" required maxLength={120} /></Field>
        <Field label="Make and model" htmlFor="make"><Input id="make" name="make" maxLength={100} /></Field>
        <Field label="Serial number" htmlFor="serial"><Input id="serial" name="serial" maxLength={120} /></Field>
        <Button disabled={!sites.length}>Register asset</Button>
      </form>
    </Card>
  </>;
}

async function Invoices({ actor }: { actor: Actor }) {
  const [result, jobs] = await Promise.all([
    actor.db.from("invoices").select("id, job_id, state, total_cents, vat_cents, due_at, client:clients(name), job:jobs(number)").eq("org_id", actor.org_id).order("created_at", { ascending: false }),
    listJobs(actor, "completed"),
  ]);
  if (result.error) throw new Error("Could not load invoices.");
  const eligible = jobs.jobs.filter((j) => !result.data.some((invoice) => invoice.job_id === j.id && invoice.state !== "void"));
  return <>
    <Card>
      <h2 className="font-semibold">Invoice register</h2>
      <ul className="divide-y divide-border">{result.data.map((invoice) => <li key={invoice.id} className={record}>
        <div><p className="font-semibold">{invoice.client?.name} {invoice.job ? `· Job #${invoice.job.number}` : ""}</p><p className="capitalize">{invoice.state} · Due {fmtDayTime(invoice.due_at)}</p></div>
        <div><p className="font-semibold">{zar.format(invoice.total_cents / 100)}</p><p>VAT {zar.format(invoice.vat_cents / 100)}</p></div>
      </li>)}</ul>
      {result.data.length === 0 && <p>No invoice records yet.</p>}
    </Card>
    <Card>
      <h2 className="mb-3 font-semibold">Create invoice draft</h2>
      {eligible.length ? <form action={workspaceAction.bind(null, "invoices")} className="grid gap-3 sm:grid-cols-2">
        <Field label="Completed job" htmlFor="job"><Select id="job" name="job" required defaultValue=""><option value="" disabled>Choose a job</option>
          {eligible.map((job) => <option key={job.id} value={job.id}>#{job.number} · {job.title}</option>)}
        </Select></Field>
        <Field label="Subtotal in rand" htmlFor="subtotal"><Input id="subtotal" name="subtotal" type="number" min="0" step="0.01" required /></Field>
        <Field label="Due date" htmlFor="due"><Input id="due" name="due" type="date" required /></Field>
        <Button className="self-end">Create draft</Button>
      </form> : <p>Complete a job to create a draft invoice.</p>}
    </Card>
  </>;
}

async function Reports({ actor }: { actor: Actor }) {
  const { jobs } = await listJobs(actor);
  const complete = jobs.filter((j) => j.stage === "completed");
  const measures = [
    ["Awaiting approval", jobs.filter((j) => j.approval === "awaiting").length],
    ["Approved and unassigned", jobs.filter((j) => j.approval === "approved" && j.stage === "unassigned").length],
    ["Overdue", jobs.filter((j) => isOverdue(j.stage, j.scheduled_end)).length],
    ["Completed in the field", complete.length],
  ] as const;
  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{measures.map(([label, value]) => <Card key={label}>
      <p className="text-text-muted">{label}</p><p className="text-2xl font-bold">{value}</p>
    </Card>)}</div>
    <Card>
      <h2 className="font-semibold">Estimate versus actual time</h2>
      <ul className="divide-y divide-border">{complete.map((j) => <li key={j.id} className={record}>
        <JobLink {...j} /><p>Estimate {j.estimate_min === null ? "—" : fmtDuration(j.estimate_min * 60)} · On site {fmtDuration(j.on_site_seconds)}</p>
      </li>)}</ul>
      {complete.length === 0 && <p>Completed jobs with recorded time will appear here.</p>}
    </Card>
  </>;
}

async function Locations({ actor }: { actor: Actor }) {
  const { data, error } = await actor.db.from("member_locations").select("member_id, lat, lng, recorded_at, member:members(display_name)")
    .eq("org_id", actor.org_id).order("recorded_at", { ascending: false });
  if (error) throw new Error("Could not load field locations.");
  return <Card>
    <h2 className="font-semibold">Last shared locations</h2>
    <ul className="divide-y divide-border">{data.map((location) => <li key={location.member_id} className={record}>
      <div><p className="font-semibold">{location.member?.display_name ?? "Field worker"}</p><p>Shared {fmtDayTime(location.recorded_at)}</p></div>
      <a className="text-accent-text underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`}>Open map</a>
    </li>)}</ul>
    {!data.length && <p>Locations appear when field workers share them.</p>}
  </Card>;
}

async function Settings({ actor }: { actor: Actor }) {
  const people = await listMembers(actor);
  return <>
    <Card>
      <h2 className="font-semibold">Team and trade coverage</h2>
      <ul className="divide-y divide-border">{people.map((member) => <li key={member.id} className="py-3">
        <p><strong>{member.display_name}</strong> · <span className="capitalize">{member.role.replaceAll("_", " ")}</span></p>
        {actor.role === "admin" && (member.role === "engineer" || member.role === "contractor") ? (
          <form className="mt-2 flex flex-wrap items-center gap-3" action={workspaceAction.bind(null, "settings")}>
            <input type="hidden" name="member" value={member.id} />
            {trades.map((trade) => <label key={trade} className="flex items-center gap-1">
              <input type="checkbox" name="trade" value={trade.toLowerCase()} defaultChecked={member.skills.includes(trade.toLowerCase())} />{trade}
            </label>)}
            <Button size="sm" variant="secondary">Save trades</Button>
          </form>
        ) : member.skills.length > 0 && <p>{member.skills.join(", ")}</p>}
      </li>)}</ul>
    </Card>
    <Card>
      <h2 className="font-semibold">WhatsApp notifications</h2>
      <p className="mt-2">Job Card Mobile · +27 60 017 8025</p>
      <p className="text-text-muted">Live delivery awaits Meta number verification and the WhatChimp connection.</p>
    </Card>
  </>;
}

export default async function WorkspaceSection({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ saved?: string; error?: string; date?: string }>;
}) {
  const actor = await requireOffice();
  const { section } = await params;
  const query = await searchParams;
  if (!Object.hasOwn(titles, section)) notFound();
  return <div className="space-y-4">
    <h1 className="text-xl font-bold">{titles[section]}</h1>
    {query.saved && <p role="status">Saved.</p>}
    {query.error && <p role="alert" className="text-danger">{query.error}</p>}
    {section === "schedule" && <Schedule actor={actor} selected={query.date} />}
    {section === "clients" && <Clients actor={actor} />}
    {section === "assets" && <Assets actor={actor} />}
    {section === "invoices" && <Invoices actor={actor} />}
    {section === "reports" && <Reports actor={actor} />}
    {section === "map" && <Locations actor={actor} />}
    {section === "settings" && <Settings actor={actor} />}
  </div>;
}
