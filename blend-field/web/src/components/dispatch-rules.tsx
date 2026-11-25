import { saveDispatchRule } from "@/app/dispatch-actions";
import { Button, Card, Field, Select } from "@/components/ui";
import type { Actor } from "@/server/auth";
import { listMembers, listSitesForPicker } from "@/server/repo";

const trades = ["General maintenance", "Plumbing", "Electrical"];

export async function DispatchRules({ actor }: { actor: Actor }) {
  const [sites, people, rules] = await Promise.all([
    listSitesForPicker(actor),
    listMembers(actor, { field: true }),
    actor.db.from("site_dispatch_rules").select("site_id,trade,member_id").order("trade"),
  ]);
  if (rules.error) throw new Error("Could not load dispatch rules.");
  const siteLabels = new Map(sites.map((site) => [site.id, site.label]));
  const workers = new Map(people.map((person) => [person.id, person.display_name]));
  const visible = rules.data.filter((rule) => siteLabels.has(rule.site_id));
  return <>
    <Card>
      <h2 className="font-semibold">Automatic assignment</h2>
      <p className="mt-2 text-text-muted">Set one active contractor for a property or unit and trade. Requests without an eligible rule or with extra requirements go to the property team for review.</p>
      <form action={saveDispatchRule} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Property or unit" htmlFor="rule-site">
          <Select id="rule-site" name="site" required defaultValue="">
            <option value="" disabled>Choose a property</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.label}</option>)}
          </Select>
        </Field>
        <Field label="Trade" htmlFor="rule-trade">
          <Select id="rule-trade" name="trade" required defaultValue="">
            <option value="" disabled>Choose a trade</option>
            {trades.map((trade) => <option key={trade} value={trade.toLowerCase()}>{trade}</option>)}
          </Select>
        </Field>
        <Field label="Contractor" htmlFor="rule-worker">
          <Select id="rule-worker" name="worker" defaultValue="">
            <option value="">Manual review</option>
            {people.map((person) => <option key={person.id} value={person.id}>
              {person.display_name}{person.skills.length ? " · " + person.skills.join(", ") : ""}
            </option>)}
          </Select>
        </Field>
        <Button className="self-end" disabled={!sites.length}>Save dispatch rule</Button>
      </form>
    </Card>
    <Card>
      <h2 className="font-semibold">Configured rules</h2>
      {visible.length ? <ul className="divide-y divide-border">{visible.map((rule) =>
        <li key={rule.site_id + rule.trade} className="py-2">
          <strong>{siteLabels.get(rule.site_id)}</strong> · <span className="capitalize">{rule.trade}</span> · {workers.get(rule.member_id) ?? "Inactive — manual review"}
        </li>)}</ul> : <p className="mt-2 text-text-muted">No rules configured. Requests go to the property team.</p>}
    </Card>
  </>;
}
