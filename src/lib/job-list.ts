import "server-only";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { CurrentUser } from "./auth";
import { jobScope } from "./job-access";
import type { JobPriority, JobStatus } from "./options";

export async function listJobs(user: CurrentUser, f: { q?: string; status?: string; priority?: string; property?: string } = {}) {
  const j = schema.jobs;
  const assignee = alias(schema.users, "assignee");
  const where: SQL[] = [jobScope(user)];
  if (f.status === "open") where.push(or(...(["awaiting_approval", "returned_for_clarification", "in_progress", "returned_for_rework", "awaiting_final_approval"] as JobStatus[]).map((s) => eq(j.status, s)))!);
  else if (f.status) where.push(eq(j.status, f.status as JobStatus));
  if (f.priority) where.push(eq(j.priority, f.priority as JobPriority));
  if (f.property) where.push(eq(j.propertyId, f.property));
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "\\$&")}%`;
    where.push(or(ilike(j.title, like), ilike(j.location, like), ilike(j.description, like), ilike(schema.properties.addressLine1, like))!);
  }
  return db
    .select({ job: j, property: schema.properties, assignee: assignee.name })
    .from(j)
    .innerJoin(schema.properties, eq(schema.properties.id, j.propertyId))
    .leftJoin(assignee, eq(assignee.id, j.assigneeId))
    .where(and(...where))
    .orderBy(desc(j.updatedAt))
    .limit(500);
}
