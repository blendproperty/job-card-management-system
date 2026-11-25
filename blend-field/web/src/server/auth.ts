import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer, type Db } from "./supabase";
import type { Member } from "./types";

/** The signed-in team member plus a client that acts as them (all queries run under RLS). */
export type Actor = Member & { db: Db };

export async function currentActor(): Promise<Actor | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser(); // verified with the auth server, not just the cookie
  if (!user) return null;
  const { data: member } = await db.from("members").select("*").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  return member ? { ...member, db } : null;
}

export async function requireOffice(): Promise<Actor> {
  const a = await currentActor();
  if (!a) redirect("/login");
  if (a.role !== "office" && a.role !== "admin") redirect("/login?reason=field");
  return a;
}
