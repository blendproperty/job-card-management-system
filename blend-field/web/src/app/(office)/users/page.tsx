import Link from "next/link";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { requireAdmin } from "@/server/auth";
import { managerRoles, roleLabels } from "@/server/roles";
import { queueTenantInvitation, saveManagerAccount, saveTenantAccess, toggleManagerAccount } from "../../workspace-access-actions";

export const metadata = { title: "Users and access" };

const errors: Record<string, string> = {
  form: "Check the name, email and access options.",
  identity: "The sign-in account could not be prepared. Try again or contact the workspace administrator.",
  role: "Access could not be saved. This email may already have a different role.",
  invitation: "Enable view-only access before emailing a sign-in invitation.",
};

const invitationStatus: Record<string, string> = {
  queued: "Queued", sending: "Sending", accepted: "Accepted by mail server",
  failed: "Failed", uncertain: "Delivery uncertain", skipped: "Skipped",
};

export default async function UsersPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const actor = await requireAdmin();
  const [roster, query] = await Promise.all([actor.db.rpc("workspace_access_list", { p_org: actor.org_id }), searchParams]);
  if (roster.error) throw new Error("Could not load users and access.");
  const staff = roster.data.filter((person) => person.role !== "tenant");
  const tenants = roster.data.filter((person) => person.role === "tenant");
  return <div className="space-y-4">
    <h1 className="text-xl font-bold">Users and access</h1>
    {query.saved && <p role="status">{query.saved === "invitation" ? "Tenant sign-in invitation queued." : query.saved === "tenant" ? "Tenant access saved. No invitation emailed." : "Manager access saved."}</p>}
    {query.error && <p role="alert" className="text-danger">{errors[query.error] ?? "Could not save access."}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Add or update a manager</h2>
        <p className="mt-2 text-sm text-text-muted">Enter the work email they will use to sign in. Enter the same email to change an existing manager’s role.</p>
        <form action={saveManagerAccount} className="mt-4 grid gap-3">
          <Field label="Full name" htmlFor="manager-name" required><Input id="manager-name" name="name" minLength={2} maxLength={120} required /></Field>
          <Field label="Work email" htmlFor="manager-email" required><Input id="manager-email" name="email" type="email" maxLength={254} required /></Field>
          <Field label="Role" htmlFor="manager-role" required><Select id="manager-role" name="role" defaultValue="" required>
            <option value="" disabled>Choose a role</option>
            {managerRoles.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}
          </Select></Field>
          <Button className="justify-self-start">Save manager</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Role permissions</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-muted">
          <li>Facilities, Asset and Property Managers can create, review and allocate jobs in this organisation.</li>
          <li>Facilities Managers and administrators can close completed jobs.</li>
          <li>Administrators manage accounts and access.</li>
          <li>Tenants can view their own jobs at permitted properties. Enable job requests separately if needed.</li>
        </ul>
      </Card>
    </div>
    <Card>
      <h2 className="font-semibold">Staff and contractors</h2>
      <ul className="mt-2 divide-y divide-border">{staff.map((person) => <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={person.id}>
        <div><p className="font-medium">{person.name}</p><p className="break-all text-sm text-text-muted">{person.email}</p></div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{roleLabels[person.role as keyof typeof roleLabels] ?? person.role} · {person.access === "active" ? "Active" : "Disabled"}</span>
          {(managerRoles.some((role) => role === person.role) || person.role === "office") && <form action={toggleManagerAccount}>
            <input type="hidden" name="member" value={person.id} />
            <input type="hidden" name="active" value={person.access === "active" ? "no" : "yes"} />
            <Button variant="secondary" size="sm" aria-label={person.access === "active" ? "Disable " + person.name : "Enable " + person.name}>
              {person.access === "active" ? "Disable" : "Enable"}
            </Button>
          </form>}
        </div>
      </li>)}</ul>
    </Card>
    <Card>
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="font-semibold">Tenant portal access</h2>
        <Link href="/tenants" className="text-sm font-medium text-accent-text underline">Register tenants</Link>
      </div>
      <p className="mt-2 text-sm text-text-muted">Keep contacts on hold until you are ready to give them access. When the portal is ready, enable view-only access and select Email sign-in invitation.</p>
      {!tenants.length ? <p className="mt-3 text-sm">No tenant contacts yet.</p> :
        <ul className="mt-2 divide-y divide-border">{tenants.map((person) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={person.id}>
          <div><p className="font-medium">{person.name} · {person.site}</p><p className="break-all text-sm text-text-muted">{person.email}</p></div>
          <div className="flex flex-wrap items-center gap-3">
          <form action={saveTenantAccess} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="contact" value={person.id} />
            <label htmlFor={person.id} className="sr-only">Access for {person.name}</label>
            <Select id={person.id} name="access" defaultValue={person.access === "held" ? "disabled" : person.access}>
              <option value="disabled">On hold</option><option value="view">View only</option><option value="request">View and add jobs</option>
            </Select>
            <Button variant="secondary" size="sm">Save access</Button>
          </form>
          {person.access === "view" && <form action={queueTenantInvitation} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="contact" value={person.id} />
            {person.invitation && <span className="text-text-muted">{invitationStatus[person.invitation]}</span>}
            {(!person.invitation || ["failed", "skipped"].includes(person.invitation)) &&
              <Button size="sm" variant="secondary">Email sign-in invitation</Button>}
          </form>}
          </div>
        </li>)}</ul>}
    </Card>
  </div>;
}
