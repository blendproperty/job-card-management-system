import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { requireOffice } from "@/server/auth";

// Stub routes for the screen inventory so navigation is complete. Each names the milestone that builds it.
const SECTIONS: Record<string, { title: string; screen: string; milestone: string; hint: string }> = {
  map: { title: "Live map", screen: "S02", milestone: "M1", hint: "Everyone in the field on one map, updating live." },
  schedule: { title: "Schedule", screen: "S06", milestone: "M1", hint: "Day and week calendar with drag-to-reassign." },
  clients: { title: "Clients", screen: "S07", milestone: "M1", hint: "Owners, buildings, units and tenants." },
  assets: { title: "Assets", screen: "S09", milestone: "M2", hint: "Geysers, gate motors and pumps with service due dates." },
  invoices: { title: "Invoices", screen: "S18", milestone: "M2", hint: "Quotes, owner approval and invoices sent to Xero." },
  reports: { title: "Reports", screen: "S14", milestone: "M2", hint: "Estimate against actual time, by job type." },
  settings: { title: "Settings", screen: "S15–S17", milestone: "M2", hint: "Team, skills, job statuses and integrations." },
};

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  return { title: SECTIONS[(await params).section]?.title ?? "Not found" };
}

export default async function SectionStub({ params }: { params: Promise<{ section: string }> }) {
  await requireOffice();
  const s = SECTIONS[(await params).section];
  if (!s) notFound();
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">{s.title}</h1>
      <EmptyState icon={<Construction />} title={`Coming in ${s.milestone}`} hint={`${s.hint} (${s.screen})`} />
    </>
  );
}
