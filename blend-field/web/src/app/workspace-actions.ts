"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOffice } from "@/server/auth";
import { localInputToIso } from "@/lib/format";

const id = z.uuid();
const name = z.string().trim().min(2).max(120);
const date = z.iso.date();

export async function workspaceAction(section: string, form: FormData) {
  const actor = await requireOffice();
  if (!["clients", "assets", "schedule", "invoices", "settings"].includes(section)) return;
  const target = "/" + section;
  const input = (key: string) => String(form.get(key) ?? "").trim();
  const fail = (message: string): never => redirect(target + "?error=" + encodeURIComponent(message));
  const db = actor.db;
  let result: { error: { code?: string } | null };
  if (section === "clients" && input("kind") === "client") {
    const client = name.safeParse(input("name"));
    if (!client.success) return fail("Enter a client name.");
    result = await db.from("clients").insert({ org_id: actor.org_id, name: client.data });
  } else if (section === "clients") {
    const site = z.object({ client: id, name, address: z.string().min(3).max(280) }).safeParse({
      client: input("client"), name: input("name"), address: input("address"),
    });
    if (!site.success) return fail("Choose a client and fill in the property name and address.");
    const { data } = await db.from("clients").select("id").eq("org_id", actor.org_id).eq("id", site.data.client).maybeSingle();
    if (!data) return fail("Choose a client in this organisation.");
    result = await db.from("sites").insert({ org_id: actor.org_id, client_id: data.id, label: site.data.name, address: site.data.address });
  } else if (section === "assets") {
    const asset = z.object({ site: id, type: name, make: z.string().max(100), serial: z.string().max(120) }).safeParse({
      site: input("site"), type: input("type"), make: input("make"), serial: input("serial"),
    });
    if (!asset.success) return fail("Choose a property and enter an asset type.");
    const { data } = await db.from("sites").select("id").eq("org_id", actor.org_id).eq("id", asset.data.site).maybeSingle();
    if (!data) return fail("Choose a property in this organisation.");
    result = await db.from("assets").insert({ org_id: actor.org_id, site_id: data.id, type: asset.data.type,
      make: asset.data.make || null, serial: asset.data.serial || null });
  } else if (section === "schedule") {
    const job = id.safeParse(input("job"));
    const start = localInputToIso(input("start"));
    const end = localInputToIso(input("end"));
    if (!job.success || !start || !end || end <= start) return fail("Choose a job and a valid start and end time.");
    const { data, error } = await db.from("jobs").update({ scheduled_start: start, scheduled_end: end })
      .eq("org_id", actor.org_id).eq("id", job.data).is("locked_at", null).select("id").maybeSingle();
    if (!error && !data) return fail("Choose an open job in this organisation.");
    result = { error };
  } else if (section === "invoices") {
    const job = id.safeParse(input("job"));
    const value = input("subtotal");
    const due = date.safeParse(input("due"));
    if (!job.success || !/^[0-9]{1,7}(?:\.[0-9]{1,2})?$/.test(value) || !due.success) return fail("Choose a completed job, enter an amount and pick a due date.");
    const parts = value.split(".");
    const subtotal = Number(parts[0]) * 100 + Number((parts[1] ?? "").padEnd(2, "0"));
    const vat = Math.round(subtotal * .15);
    const { data } = await db.from("jobs").select("id, client_id").eq("org_id", actor.org_id).eq("id", job.data).eq("stage", "completed").maybeSingle();
    if (!data) return fail("Choose a completed job in this organisation.");
    result = await db.from("invoices").insert({ org_id: actor.org_id, job_id: data.id, client_id: data.client_id,
      state: "draft", subtotal_cents: subtotal, vat_cents: vat, total_cents: subtotal + vat, due_at: due.data + "T00:00:00+02:00" });
  } else {
    if (actor.role !== "admin") return fail("An administrator can update worker trades.");
    const member = id.safeParse(input("member"));
    const trades = form.getAll("trade").map(String);
    const allowed = ["general maintenance", "plumbing", "electrical", "other"];
    if (!member.success || trades.some((trade) => !allowed.includes(trade))) return fail("Choose a worker and valid trades.");
    const { data, error } = await db.from("members").select("skills").eq("org_id", actor.org_id).eq("id", member.data)
      .in("role", ["engineer", "contractor"]).maybeSingle();
    if (error || !data) return fail("Choose a worker from this organisation.");
    result = await db.from("members").update({ skills: [...new Set([...data.skills.filter((s) => !allowed.includes(s)), ...trades])] })
      .eq("org_id", actor.org_id).eq("id", member.data);
  }
  if (result.error) return fail(result.error.code === "23505" ? "A record for this job already exists." : "Could not save. Check the details and try again.");
  redirect(target + "?saved=1");
}
