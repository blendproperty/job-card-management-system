import { requireOffice } from "@/server/auth";
import { listMembers, listSitesForPicker } from "@/server/repo";
import { NewJobForm } from "./new-job-form";

export const metadata = { title: "New job" };

/** S04 New job. */
export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const me = await requireOffice();
  const [sites, people, sp] = await Promise.all([listSitesForPicker(me), listMembers(me, { field: true }), searchParams]);
  return (
    <div className="max-w-[720px]">
      <h1 className="mb-4 text-xl font-bold">New job</h1>
      <NewJobForm
        sites={sites.map((s) => ({ id: s.id, label: s.label, client: s.client_name }))}
        people={people.map((p) => ({ id: p.id, name: p.display_name, skills: p.skills }))}
        defaultSite={sp.site}
      />
    </div>
  );
}
