import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/server/supabase";
import { Button, ButtonLink, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fmtDayTime } from "@/lib/format";
import { saveTenantEmailPreference, saveTenantProfile, signOutAction, submitTenantRequest } from "../actions";

export const metadata = { title: "Tenant portal" };

export default async function RequestsPage({ searchParams }: {
  searchParams: Promise<{ submitted?: string; error?: string; profile?: string; new?: string; saved?: string; email?: string }>;
}) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const [sites, requestSites, requests, contact, alerts, preference, state] = await Promise.all([
    db.rpc("tenant_sites"), db.rpc("requestable_tenant_sites"), db.rpc("tenant_requests"),
    db.from("tenant_profiles").select("first_name,surname,company,phone").eq("user_id", user.id).maybeSingle(),
    db.rpc("my_workflow_alerts", { p_audience: "tenant" }), db.rpc("workflow_email_enabled", { p_audience: "tenant" }), searchParams,
  ]);
  if (sites.error || requestSites.error || requests.error || contact.error || alerts.error) throw new Error("Could not load the tenant portal.");
  const profile = contact.data;
  const canRequest = requestSites.data.length > 0;
  const showProfile = canRequest && (!profile || state.profile === "1");
  const entries = requests.data;
  const closed = entries.filter((request) => ["Closed", "Declined", "Cancelled"].includes(request.status));
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-accent-text">Tenant portal</p>
          <h1 className="text-2xl font-bold">My maintenance</h1>
          {profile && <p className="text-text-muted">{profile.first_name} {profile.surname} · {profile.company}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canRequest && <ButtonLink href="/requests?new=1">New request</ButtonLink>}
          <form action={signOutAction}><Button type="submit" variant="secondary">Sign out</Button></form>
        </div>
      </header>
      {state.submitted && <p role="status">Request #{state.submitted} submitted.</p>}
      {state.saved && <p role="status">Contact details saved.</p>}
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error === "profile" ? "Enter your name, company and a valid contact number." :
            state.error === "save" ? "Could not save your contact details. Try again." :
              "Could not submit the request. Check the property, trade and details."}
        </p>
      )}
      <section aria-label="Request summary" className="grid grid-cols-3 gap-2">
        {[["Total", entries.length], ["Open", entries.length - closed.length], ["Resolved", closed.length]].map(([label, count]) => (
          <Card key={label} className="p-3 sm:p-4">
            <p className="text-sm text-text-muted">{label}</p><p className="text-2xl font-bold">{count}</p>
          </Card>
        ))}
      </section>
      {!!sites.data.length && <p className="text-text-muted">{sites.data.map((site) => site.label).join(" · ")}</p>}
      {showProfile ? (
        <Card>
          <h2 className="mb-2 font-semibold">Your contact details</h2>
          <p className="mb-4 text-sm text-text-muted">These details will be added to new requests you submit.</p>
          <form action={saveTenantProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="first_name" required><Input name="first_name" id="first_name" autoComplete="given-name" required maxLength={80} defaultValue={profile?.first_name} /></Field>
            <Field label="Surname" htmlFor="surname" required><Input name="surname" id="surname" autoComplete="family-name" required maxLength={80} defaultValue={profile?.surname} /></Field>
            <Field label="Company" htmlFor="company" required><Input name="company" id="company" autoComplete="organization" required maxLength={120} placeholder="Company name or Individual" defaultValue={profile?.company} /></Field>
            <Field label="Contact number" htmlFor="phone" required><Input name="phone" id="phone" type="tel" autoComplete="tel" required placeholder="e.g. 082 123 4567" defaultValue={profile?.phone} /></Field>
            <Field label="Login email" htmlFor="profile-email"><Input id="profile-email" type="email" readOnly value={user.email ?? ""} /></Field>
            <Button type="submit" className="self-end">Save contact details</Button>
          </form>
        </Card>
      ) : profile && state.new === "1" && canRequest ? (
        <Card>
          <h2 className="mb-3 font-semibold">New maintenance request</h2>
          <div className="mb-4 rounded-md bg-surface p-3">
            <p className="font-semibold">Requested by {profile.first_name} {profile.surname}</p>
            <p className="break-words text-sm">{profile.company} · {user.email} · {profile.phone}</p>
            <Link href="/requests?profile=1" className="text-sm text-accent-text underline">Edit contact details</Link>
          </div>
          <form action={submitTenantRequest} className="flex flex-col gap-4">
            <Field label="Property or unit" htmlFor="site" required>
              <Select id="site" name="site" required defaultValue={requestSites.data.length === 1 ? requestSites.data[0].id : ""}>
                <option value="" disabled>Choose a property</option>
                {requestSites.data.map((site) => <option key={site.id} value={site.id}>{site.label}</option>)}
              </Select>
            </Field>
            <Field label="Trade" htmlFor="trade" required>
              <Select id="trade" name="trade" required defaultValue="">
                <option value="" disabled>Choose a trade</option>
                <option value="general maintenance">General maintenance</option><option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option><option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Title" htmlFor="title" required><Input id="title" name="title" required minLength={3} maxLength={120} /></Field>
            <Field label="Details" htmlFor="description" required><Textarea id="description" name="description" required maxLength={2000} /></Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="manual_review" className="mt-1" />
              This request needs special access, a particular qualification or another requirement for the property team to review.
            </label>
            <Button type="submit">Submit request</Button>
          </form>
        </Card>
      ) : !sites.data.length ? <Card>Ask the property team to grant you access to your property.</Card> :
        canRequest ? <Link href="/requests?profile=1" className="text-accent-text underline">Edit my contact details</Link> : <p className="text-sm text-text-muted">View-only access. Contact your property team for new maintenance work.</p>}
      {!showProfile && state.new !== "1" && canRequest && !preference.error && <Card>
        <h2 className="font-semibold">Job email updates</h2>
        {state.email === "saved" && <p role="status" className="mt-2">Email preference saved.</p>}
        {state.email === "error" && <p role="alert" className="mt-2 text-danger">Could not save your email preference.</p>}
        <form action={saveTenantEmailPreference} className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="workflow-email" defaultChecked={preference.data ?? false} />
            Email updates to my sign-in address
          </label>
          <Button variant="secondary" type="submit">Save email preference</Button>
        </form>
      </Card>}
      {alerts.data.length > 0 && <Card>
        <h2 className="font-semibold">Notifications</h2>
        <ul className="divide-y divide-border">{alerts.data.map((alert) => <li key={alert.event_id} className="py-2">
          <p>#{alert.number} · {alert.message}</p>
          <p className="text-xs text-text-muted">{fmtDayTime(alert.created_at)}</p>
        </li>)}</ul>
      </Card>}
      <Card>
        <h2 className="font-semibold">My requests</h2>
        {entries.length ? <ul className="divide-y divide-border">{entries.map((request) => (
          <li key={request.number + request.logged_at} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div><p className="font-medium">#{request.number} · {request.title}</p><p className="text-sm text-text-muted">{fmtDayTime(request.logged_at)}</p></div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold">{request.status}</span>
          </li>
        ))}</ul> : <p className="mt-2 text-text-muted">Your submitted requests will appear here.</p>}
      </Card>
    </main>
  );
}
