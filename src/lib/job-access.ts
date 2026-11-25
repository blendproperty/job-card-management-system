import "server-only";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "./auth";
import { canSeeJob, isWorker, propertyScope } from "./permissions";
import { isUuid } from "./format";

export async function loadJob(user: CurrentUser, id: string) {
  if (!isUuid(id)) return null;
  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, id) });
  if (!job) return null;
  const property = await db.query.properties.findFirst({ where: eq(schema.properties.id, job.propertyId) });
  if (!property || !canSeeJob(user, job, property)) return null;
  return { job, property };
}

/** SQL filter equivalent of canSeeJob, for lists. */
export function jobScope(user: CurrentUser): SQL {
  const j = schema.jobs;
  const org = eq(j.orgId, user.orgId);
  if (user.role === "admin") return org;
  if (user.role === "manager" || user.role === "portfolio") {
    const scoped = propertyScope(user);
    return and(org, inArray(j.propertyId, db.select({ id: schema.properties.id }).from(schema.properties).where(scoped)))!;
  }
  if (isWorker(user)) return and(org, eq(j.assigneeId, user.id))!;
  return and(org, eq(j.requesterId, user.id))!;
}

/** Active staff and contractors who cover a property (or the building it sits in). */
export async function workersFor(orgId: string, property: { id: string; parentId: string | null }) {
  const ids = [property.id, property.parentId].filter(Boolean) as string[];
  return db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(
      and(
        eq(schema.memberships.orgId, orgId),
        inArray(schema.memberships.role, ["staff", "contractor"]),
        inArray(schema.memberships.propertyId, ids),
        eq(schema.users.active, true),
      ),
    );
}

