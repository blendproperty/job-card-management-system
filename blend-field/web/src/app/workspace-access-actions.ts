"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { managerRoles } from "@/server/roles";

async function ensureIdentity(email: string) {
  const key = process.env.SUPABASE_AUTH_ADMIN_KEY;
  if (!key) return false;
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin;
  const { error } = await auth.createUser({ email, email_confirm: false });
  return !error || error.code === "email_exists" || error.code === "user_already_exists";
}

const manager = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(2).max(120),
  role: z.enum(managerRoles),
});

export async function saveManagerAccount(form: FormData) {
  const actor = await requireAdmin();
  const result = manager.safeParse({
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    name: form.get("name"),
    role: form.get("role"),
  });
  if (!result.success) redirect("/users?error=form");
  const { email, name, role } = result.data;
  if (!await ensureIdentity(email)) redirect("/users?error=identity");
  const { error } = await actor.db.rpc("save_workspace_manager", {
    p_org: actor.org_id, p_email: email, p_name: name, p_role: role,
  });
  if (error) redirect("/users?error=role");
  redirect("/users?saved=manager");
}

export async function toggleManagerAccount(form: FormData) {
  const actor = await requireAdmin();
  const member = z.uuid().safeParse(form.get("member"));
  const active = form.get("active");
  if (!member.success || (active !== "yes" && active !== "no")) redirect("/users?error=form");
  const { error } = await actor.db.rpc("set_workspace_manager_active", {
    p_org: actor.org_id, p_member: member.data, p_active: active === "yes",
  });
  if (error) redirect("/users?error=role");
  redirect("/users?saved=manager");
}

export async function saveTenantAccess(form: FormData) {
  const actor = await requireAdmin();
  const contact = z.uuid().safeParse(form.get("contact"));
  const mode = z.enum(["disabled", "view", "request"]).safeParse(form.get("access"));
  if (!contact.success || !mode.success) redirect("/users?error=form");
  const { data } = await actor.db.from("people_register").select("email")
    .eq("org_id", actor.org_id).eq("kind", "tenant").eq("id", contact.data).maybeSingle();
  if (!data) redirect("/users?error=role");
  if (mode.data !== "disabled" && !await ensureIdentity(data.email)) redirect("/users?error=identity");
  const { error } = await actor.db.rpc("set_workspace_tenant", {
    p_org: actor.org_id, p_contact: contact.data, p_mode: mode.data,
  });
  if (error) redirect("/users?error=role");
  redirect("/users?saved=tenant");
}

export async function queueTenantInvitation(form: FormData) {
  const actor = await requireAdmin();
  const contact = z.uuid().safeParse(form.get("contact"));
  if (!contact.success) redirect("/users?error=form");
  const { error } = await actor.db.rpc("queue_workspace_tenant_invite", {
    p_org: actor.org_id, p_contact: contact.data,
  });
  if (error) redirect("/users?error=invitation");
  redirect("/users?saved=invitation");
}
