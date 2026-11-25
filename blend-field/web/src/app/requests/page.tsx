import { redirect } from "next/navigation";
import { supabaseServer } from "@/server/supabase";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fmtDayTime } from "@/lib/format";
import { signOutAction, submitTenantRequest } from "../actions";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const [sites, requests] = await Promise.all([db.rpc("tenant_sites"), db.rpc("tenant_requests")]);
  if (sites.error || requests.error) throw new Error("Could not load maintenance requests.");
  const state = await searchParams;
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Maintenance requests</h1>
        <form action={signOutAction}><Button type="submit" variant="secondary">Sign out</Button></form>
      </header>
      {state.submitted && <p role="status">Request {state.submitted} submitted for approval.</p>}
      {state.error && <p role="alert">Could not submit the request. Check the property, trade and details.</p>}
      {sites.data.length ? (
        <Card>
          <form action={submitTenantRequest} className="flex flex-col gap-4">
            <Field label="Property" htmlFor="site" required>
              <Select id="site" name="site" required defaultValue="">
                <option value="" disabled>Choose a property</option>
                {sites.data.map((site) => <option key={site.id} value={site.id}>{site.label}</option>)}
              </Select>
            </Field>
            <Field label="Trade" htmlFor="trade" required>
              <Select id="trade" name="trade" required defaultValue="">
                <option value="" disabled>Choose a trade</option>
                <option value="general maintenance">General maintenance</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Title" htmlFor="title" required><Input id="title" name="title" required minLength={3} maxLength={120} /></Field>
            <Field label="Details" htmlFor="description" required><Textarea id="description" name="description" required maxLength={2000} /></Field>
            <Button type="submit">Submit request</Button>
          </form>
        </Card>
      ) : <p>Ask the property team to grant you access to your property.</p>}
      {requests.data.length > 0 && (
        <Card>
          <h2 className="font-semibold">Your requests</h2>
          <ul className="divide-y divide-border">{requests.data.map((request) => (
            <li key={request.number + request.logged_at} className="py-3">
              <p className="font-medium">#{request.number} · {request.title}</p>
              <p className="text-text-muted">{request.status} · {fmtDayTime(request.logged_at)}</p>
            </li>
          ))}</ul>
        </Card>
      )}
    </main>
  );
}
