import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { propertyScope } from "@/lib/permissions";
import { addressOneLine, isUuid } from "@/lib/format";
import { loadInspection } from "@/lib/inspection-access";
import { PageHeader } from "@/components/page-header";
import { NewJobForm } from "./form";

export const metadata = { title: "Report an issue" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ property?: string; item?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = user.role === "admin" || user.role === "inspector" ? eq(schema.properties.orgId, user.orgId) : propertyScope(user);
  const properties = await db.query.properties.findMany({
    where: and(scope, eq(schema.properties.archived, false)),
    orderBy: asc(schema.properties.addressLine1),
  });

  let prefill: { propertyId?: string; title?: string; location?: string; description?: string; itemId?: string; photos?: number } = {
    propertyId: isUuid(sp.property) ? sp.property : user.propertyId ?? undefined,
  };
  if (isUuid(sp.item)) {
    const row = await db
      .select({ item: schema.inspectionItems, section: schema.inspectionSections })
      .from(schema.inspectionItems)
      .innerJoin(schema.inspectionSections, eq(schema.inspectionSections.id, schema.inspectionItems.sectionId))
      .where(eq(schema.inspectionItems.id, sp.item))
      .limit(1);
    const found = row[0] && (await loadInspection(user, row[0].section.inspectionId));
    if (found) {
      const { item, section } = row[0];
      const photos = await db.$count(schema.photos, eq(schema.photos.itemId, item.id));
      prefill = {
        propertyId: found.property.id,
        itemId: item.id,
        title: (item.comment ? `${item.name}: ${item.comment}` : `${item.name} needs attention`).slice(0, 120),
        location: section.name,
        description: item.comment ?? "",
        photos,
      };
    }
  }

  return (
    <>
      <PageHeader
        title="Report a maintenance issue"
        subtitle="Give the facilities team enough detail to assess the request."
        back={{ href: "/jobs", label: "Job cards" }}
      />
      <NewJobForm properties={properties.map((p) => ({ id: p.id, label: addressOneLine(p) }))} prefill={prefill} />
    </>
  );
}
