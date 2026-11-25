"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOffice } from "@/server/auth";

export async function saveDispatchRule(form: FormData) {
  const actor = await requireOffice();
  const site = z.uuid().safeParse(form.get("site"));
  const trade = z.enum(["general maintenance", "plumbing", "electrical", "other"]).safeParse(form.get("trade"));
  const member = z.union([z.uuid(), z.literal("")]).safeParse(form.get("worker"));
  if (!site.success || !trade.success || !member.success) redirect("/dispatch?error=selection");
  const { error } = await actor.db.rpc("set_site_dispatch_rule", {
    p_site: site.data, p_trade: trade.data, p_member: member.data || null,
  });
  if (error) redirect("/dispatch?error=worker");
  redirect("/dispatch?saved=1");
}
