import Link from "next/link";
import { saveRegister } from "@/app/register-actions";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { type Actor } from "@/server/auth";
import { listSitesForPicker } from "@/server/repo";

const fields = [
  { name: "first_name", label: "First name", max: 80, type: "text" },
  { name: "surname", label: "Surname", max: 80, type: "text" },
  { name: "company", label: "Company", max: 120, type: "text" },
  { name: "email", label: "Email", max: 254, type: "email" },
  { name: "contact_number", label: "Contact number", max: 30, type: "tel" },
];

function SitePicker({ id, sites }: { id: string; sites: Awaited<ReturnType<typeof listSitesForPicker>> }) {
  return <Field label="Property or unit" htmlFor={id}>
    <Select id={id} name="site" required defaultValue="">
      <option value="" disabled>Choose a property or unit</option>
      {sites.map((site) => <option value={site.id} key={site.id}>{site.label} · {site.address}</option>)}
    </Select>
  </Field>;
}

export async function PeopleRegister({ actor, kind, saved, page }: { actor: Actor; kind: "tenant" | "trade"; saved?: string; page?: string }) {
  const currentPage = page && /^[1-9]\d{0,4}$/.test(page) ? Number(page) : 1;
  const offset = (currentPage - 1) * 100;
  const [contacts, sites] = await Promise.all([
    actor.db.from("people_register").select("id, site_id, first_name, surname, company, email, phone, trade", { count: "exact" })
      .eq("org_id", actor.org_id).eq("kind", kind).order("surname").order("first_name").order("id").range(offset, offset + 99),
    listSitesForPicker(actor),
  ]);
  if (contacts.error) throw new Error("Could not load the register.");
  const trade = kind === "trade";
  const path = trade ? "/contractors" : "/tenants";
  const person = trade ? "contractor" : "tenant";
  const siteLabels = new Map(sites.map((site) => [site.id, site.label]));
  const columns = ["Property or unit", ...fields.map((field) => field.label), ...(trade ? ["Trade"] : [])];
  return <>
    {saved && /^\d{1,3}$/.test(saved) && <p role="status">{saved} {Number(saved) === 1 ? "record" : "records"} saved.</p>}
    {!sites.length && <p>Add a property or unit in Properties to start registering contacts.</p>}
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Add {trade ? "a contractor" : "a tenant"}</h2>
        <form action={saveRegister.bind(null, kind)} className="mt-3 grid gap-3 sm:grid-cols-2">
          <SitePicker id="contact-site" sites={sites} />
          {fields.map((field) => <Field key={field.name} label={field.label} htmlFor={field.name}>
            <Input name={field.name} id={field.name} type={field.type} maxLength={field.max} required />
          </Field>)}
          {trade && <Field label="Trade" htmlFor="trade"><Select name="trade" id="trade" required defaultValue="">
            <option value="" disabled>Choose a trade</option>
            {["General maintenance", "Plumbing", "Electrical", "Other"].map((label) => <option key={label} value={label.toLowerCase()}>{label}</option>)}
          </Select></Field>}
          <Button className="self-end" disabled={!sites.length}>Save {person}</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Upload {trade ? "contractors" : "tenants"} from CSV</h2>
        <p className="mt-2 text-text-muted">Use one file per property or unit, with up to 500 records. An existing contact with the same email{trade ? " and trade" : ""} at that property is updated.</p>
        <p className="mt-2 break-words font-mono text-sm">{fields.map((field) => field.name).join(",")}{trade && ",trade"}</p>
        {trade && <p className="mt-2 text-sm">Trade values: General maintenance, Plumbing, Electrical or Other.</p>}
        <form action={saveRegister.bind(null, kind)} className="mt-3 grid gap-3">
          <SitePicker id="csv-site" sites={sites} />
          <Field label="CSV file" htmlFor="csv"><input type="file" id="csv" name="csv" accept=".csv,text/csv" required className="block w-full text-sm" /></Field>
          <Button className="justify-self-start" disabled={!sites.length}>Upload CSV</Button>
        </form>
      </Card>
    </div>
    <Card>
      <h2 className="font-semibold">Registered {trade ? "contractors" : "tenants"}</h2>
      {contacts.data.length === 0 ? <p className="mt-2 text-text-muted">No {trade ? "contractors" : "tenants"} registered yet.</p> : <>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border">{columns.map((column) => <th scope="col" key={column} className="px-2 py-2">{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{contacts.data.map((contact) => <tr key={contact.id}>
              <td className="px-2 py-2">{siteLabels.get(contact.site_id)}</td>
              <td className="px-2 py-2">{contact.first_name}</td><td className="px-2 py-2">{contact.surname}</td>
              <td className="px-2 py-2">{contact.company}</td><td className="px-2 py-2">{contact.email}</td>
              <td className="whitespace-nowrap px-2 py-2">{contact.phone}</td>{trade && <td className="px-2 py-2 capitalize">{contact.trade}</td>}
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      {((contacts.count ?? 0) > 100 || currentPage > 1) && <nav aria-label="Register pages" className="mt-3 flex gap-4 text-sm">
        {currentPage > 1 && <Link className="underline" href={path + "?page=" + (currentPage - 1)}>Previous</Link>}
        <span>Page {currentPage}</span>
        {(contacts.count ?? 0) > offset + 100 && <Link className="underline" href={path + "?page=" + (currentPage + 1)}>Next</Link>}
      </nav>}
    </Card>
  </>;
}
