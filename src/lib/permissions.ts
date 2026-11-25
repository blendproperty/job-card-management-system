import { and, eq, or, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import type { CurrentUser } from "./auth";

export const isAdmin = (u: CurrentUser) => u.role === "admin";
/** Can approve, allocate and close job cards (as in the job card system). */
export const canManageJobs = (u: CurrentUser) => u.role === "admin" || u.role === "manager";
export const isWorker = (u: CurrentUser) => u.role === "staff" || u.role === "contractor";
/** Can add and edit properties, clients and templates. */
export const canEditProperties = (u: CurrentUser) => u.role === "admin" || u.role === "manager";
/** Can schedule and carry out inspections. */
export const canInspect = (u: CurrentUser) => u.role === "admin" || u.role === "manager" || u.role === "inspector";
/** Can see the inspections area at all. */
export const canViewInspections = (u: CurrentUser) => canInspect(u) || u.role === "portfolio";

const unscoped = (u: CurrentUser) => u.role === "admin" || u.role === "inspector";

/** WHERE clause limiting properties to those the user may see (own org; facility and its units for scoped roles). */
export function propertyScope(u: CurrentUser): SQL {
  const org = eq(schema.properties.orgId, u.orgId);
  if (unscoped(u)) return org;
  if (!u.propertyId) return and(org, eq(schema.properties.id, "00000000-0000-0000-0000-000000000000"))!;
  return and(org, or(eq(schema.properties.id, u.propertyId), eq(schema.properties.parentId, u.propertyId)))!;
}

/** Can the user see this property row? */
export function canSeeProperty(u: CurrentUser, p: { id: string; orgId: string; parentId: string | null }) {
  if (p.orgId !== u.orgId) return false;
  if (unscoped(u)) return true;
  return !!u.propertyId && (p.id === u.propertyId || p.parentId === u.propertyId);
}

/** Mirrors the job card system's visibility rule. */
export function canSeeJob(
  u: CurrentUser,
  job: { orgId: string; requesterId: string; assigneeId: string | null },
  property: { id: string; orgId: string; parentId: string | null },
) {
  if (job.orgId !== u.orgId) return false;
  if (u.role === "admin") return true;
  if (u.role === "manager" || u.role === "portfolio") return canSeeProperty(u, property);
  if (u.role === "tenant") return job.requesterId === u.id;
  if (isWorker(u)) return job.assigneeId === u.id;
  if (u.role === "inspector") return job.requesterId === u.id;
  return false;
}

/** Can open the properties area (list, detail, export). */
export const canViewProperties = (u: CurrentUser) =>
  u.role === "admin" || u.role === "manager" || u.role === "portfolio" || u.role === "inspector";
