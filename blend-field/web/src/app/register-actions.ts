"use server";

import { parse } from "csv-parse/sync";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOffice } from "@/server/auth";

const contactColumns = ["first_name", "surname", "company", "email", "contact_number"];
const trades = ["general maintenance", "plumbing", "electrical", "other"] as const;
const contact = z.object({
  first_name: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  company: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  contact_number: z.string().trim().transform((value) => value.replace(/[\s().-]/g, "").replace(/^0(?=\d{9}$)/, "+27"))
    .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/)),
});

export async function saveRegister(kind: "tenant" | "trade", form: FormData) {
  const actor = await requireOffice();
  const path = kind === "trade" ? "/contractors" : "/tenants";
  const fail = (message: string) => redirect(path + "?error=" + encodeURIComponent(message));
  if (kind !== "tenant" && kind !== "trade") return fail("Choose a register.");
  const site = z.uuid().safeParse(form.get("site"));
  if (!site.success) return fail("Choose a property or unit.");
  const { data: siteRow } = await actor.db.from("sites").select("id").eq("org_id", actor.org_id).eq("id", site.data).maybeSingle();
  if (!siteRow) return fail("Choose a property or unit in your organisation.");

  const columns = kind === "trade" ? [...contactColumns, "trade"] : contactColumns;
  const file = form.get("csv");
  const upload = file instanceof File;
  let input: Record<string, unknown>[];
  if (upload) {
    if (!file.size || file.size > 128 * 1024) return fail("Choose a CSV file up to 128 KB.");
    let records: string[][];
    try {
      const content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      records = parse(content, { bom: true, trim: true, skip_empty_lines: true, max_record_size: 2048 }) as string[][];
    } catch {
      return fail("The file could not be read. Save it as UTF-8 CSV with the columns shown.");
    }
    const [header, ...body] = records;
    if (!header || header.length !== columns.length || !columns.every((column, index) => header[index] === column)) return fail("Use the CSV column names and order shown in the register.");
    input = body.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
  } else {
    input = [Object.fromEntries(columns.map((column) => [column, form.get(column)]))];
  }
  if (input.length < 1 || input.length > 500) return fail("Include between 1 and 500 records.");

  const updatedAt = new Date().toISOString();
  const keys = new Set<string>();
  const rows = [];
  for (const [index, row] of input.entries()) {
    const parsed = contact.safeParse(row);
    const trade = kind === "trade" ? z.enum(trades).safeParse(String(row.trade ?? "").trim().toLowerCase()) : { success: true, data: "" };
    const location = upload ? "CSV record " + (index + 1) + ": " : "";
    if (!parsed.success) return fail(location + "Check first name, surname, company, email and contact number.");
    if (!trade.success || trade.data === undefined) return fail(location + "Choose General maintenance, Plumbing, Electrical or Other.");
    const { contact_number, ...details } = parsed.data;
    const key = details.email + "|" + trade.data;
    if (keys.has(key)) return fail(location + "This email and trade already appear in the file.");
    keys.add(key);
    rows.push({ ...details, phone: contact_number, trade: trade.data, kind, site_id: siteRow.id, org_id: actor.org_id, updated_at: updatedAt });
  }
  const { error } = await actor.db.from("people_register").upsert(rows, { onConflict: "org_id,site_id,kind,email,trade" });
  if (error) return fail("The register could not be saved. Check the records and try again.");
  redirect(path + "?saved=" + rows.length);
}
