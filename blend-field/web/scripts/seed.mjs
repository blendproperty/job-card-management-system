// Seeds a freshly reset local database with made-up demo data (no real people).
// Run from web/:  npm run db:reset   (supabase db reset, then this script)
// Uses the service role key from .env.local — local development only.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Refusing to seed a non-local database: ${url}`);

const db = createClient(url, key, { auth: { persistSession: false } });
const must = async (p) => { const { data, error } = await p; if (error) throw error; return data; };

// Today at hh:mm Africa/Johannesburg (UTC+2, no DST) as UTC ISO.
const today = (h, m = 0) => { const d = new Date(); d.setUTCHours(h - 2, m, 0, 0); return d.toISOString(); };

async function user(email, name) {
  const { user } = await must(db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } }));
  return user.id;
}

const [blend, other] = await must(
  db.from("orgs").insert([{ name: "Blend Property" }, { name: "Other Co (RLS test org)" }]).select(),
);

for (const org of [blend, other]) await must(db.rpc("seed_default_resolutions", { p_org: org.id }));

const people = [
  ["naledi@blend.test", "Naledi (office)", "office", []],
  ["thandi@blend.test", "Thandi Mokoena", "engineer", ["plumbing", "geysers"]],
  ["johan@blend.test", "Johan Kruger", "engineer", ["electrical", "gate motors"]],
  ["aplumbing@blend.test", "A. Plumbing (contractor)", "contractor", ["plumbing"]],
];
const members = {};
for (const [email, display_name, role, skills] of people) {
  const user_id = await user(email, display_name);
  const [m] = await must(db.from("members").insert({ org_id: blend.id, user_id, role, display_name, skills }).select());
  members[email.split("@")[0]] = m;
}
const outsiderUser = await user("sam@otherco.test", "Sam (other org)");
await must(db.from("members").insert({ org_id: other.id, user_id: outsiderUser, role: "office", display_name: "Sam (other org)" }));

const [sph, bree, kloof] = await must(db.from("clients").insert([
  { org_id: blend.id, name: "Sea Point Heights Body Corporate" },
  { org_id: blend.id, name: "Bree Lofts (Pty) Ltd" },
  { org_id: blend.id, name: "M. Daniels (owner)" },
]).select());

const [sphBuilding] = await must(db.from("sites").insert({
  org_id: blend.id, client_id: sph.id, label: "Sea Point Heights", address: "101 Beach Rd, Sea Point, Cape Town",
  access_notes: "Guard house at main gate. Sign in.",
}).select());
const [u4b, u7a, bree2, kloof12] = await must(db.from("sites").insert([
  { org_id: blend.id, client_id: sph.id, parent_site_id: sphBuilding.id, label: "Unit 4B, Sea Point Heights", address: "101 Beach Rd, Sea Point, Cape Town", access_notes: "Tenant home after 14:00. Key with guard otherwise." },
  { org_id: blend.id, client_id: sph.id, parent_site_id: sphBuilding.id, label: "Unit 7A, Sea Point Heights", address: "101 Beach Rd, Sea Point, Cape Town" },
  { org_id: blend.id, client_id: bree.id, label: "Unit 2, Bree Lofts", address: "210 Bree St, Cape Town City Centre", access_notes: "Buzzer 2. Parking on Shortmarket St." },
  { org_id: blend.id, client_id: kloof.id, label: "12 Kloof Rd", address: "12 Kloof Rd, Gardens, Cape Town", access_notes: "Dog on property. Call owner first." },
]).select());

// Insert one at a time so the per-org number trigger runs in order (1000, 1001, ...).
const job = async (site, client, title, start, end, estimate_min) =>
  (await must(db.from("jobs").insert({
    org_id: blend.id, client_id: client.id, site_id: site.id, title,
    scheduled_start: start, scheduled_end: end, estimate_min, created_by: members.naledi.id,
  }).select()))[0];

const j1 = await job(u4b, sph, "Geyser not heating", today(10, 30), today(12), 90);
const j2 = await job(kloof12, kloof, "Gate motor stuck half open", today(13), today(14), 60);
await job(bree2, bree, "Leak under kitchen sink", null, null, 45);
const j4 = await job(u7a, sph, "Change locks after move-out", today(9), today(10), 45);

for (const [j, m] of [[j1, members.thandi], [j2, members.johan], [j4, members.thandi]]) {
  await must(db.from("job_assignments").insert({ job_id: j.id, member_id: m.id }));
  await must(db.from("jobs").update({ stage: "assigned" }).eq("id", j.id));
}

// A job in the other org, to prove Blend users can't see it.
const [oc] = await must(db.from("clients").insert({ org_id: other.id, name: "Other Co client" }).select());
const [os] = await must(db.from("sites").insert({ org_id: other.id, client_id: oc.id, label: "Other Co site", address: "1 Elsewhere St" }).select());
await must(db.from("jobs").insert({ org_id: other.id, client_id: oc.id, site_id: os.id, title: "Other org's private job" }));

console.log("Seeded. Sign in with any of:", [...people.map((p) => p[0]), "sam@otherco.test"].join(", "));
console.log("Codes arrive in Mailpit: http://127.0.0.1:54324");
