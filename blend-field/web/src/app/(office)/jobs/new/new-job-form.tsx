"use client";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, ButtonLink, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { createJobAction, type FormState } from "../../../actions";

type Props = {
  sites: { id: string; label: string; client: string }[];
  people: { id: string; name: string; skills: string[] }[];
  defaultSite?: string;
};

export function NewJobForm({ sites, people, defaultSite }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(createJobAction, undefined);
  const f = state?.fields ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error && (
        <p role="alert" className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-danger">
          <AlertCircle aria-hidden className="size-4 shrink-0" />{state.error}
        </p>
      )}
      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">What and where</h2>
        <Field label="Title" htmlFor="title" required help="Short and plain. The tenant sees this in updates.">
          <Input id="title" name="title" required maxLength={120} defaultValue={f.title} placeholder="e.g. Geyser not heating" aria-describedby="title-help" />
        </Field>
        <Field label="Site" htmlFor="site_id" required>
          <Select id="site_id" name="site_id" required defaultValue={f.site_id ?? defaultSite ?? ""}>
            <option value="" disabled>Choose a property or unit</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.client}</option>)}
          </Select>
        </Field>
        <Field label="Trade" htmlFor="trade" required>
          <Select id="trade" name="trade" required defaultValue={f.trade ?? ""}>
            <option value="" disabled>Choose a trade</option>
            <option value="general maintenance">General maintenance</option>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Details" htmlFor="description">
          <Textarea id="description" name="description" maxLength={2000} defaultValue={f.description} placeholder="What's wrong, anything the engineer should bring" />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">When and who</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="start"><Input id="start" name="start" type="datetime-local" defaultValue={f.start} /></Field>
          <Field label="Ends" htmlFor="end"><Input id="end" name="end" type="datetime-local" defaultValue={f.end} /></Field>
        </div>
        <Field label="Estimate (minutes)" htmlFor="estimate_min">
          <Input id="estimate_min" name="estimate_min" type="number" inputMode="numeric" min={1} max={1440} defaultValue={f.estimate_min} className="max-w-40" />
        </Field>
        <Field label="Preferred worker" htmlFor="assignee_id" help="Leave blank to allocate by trade when approved.">
          <Select id="assignee_id" name="assignee_id" defaultValue={f.assignee_id ?? ""} aria-describedby="assignee_id-help">
            <option value="">Allocate by trade on approval</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.skills.length ? ` · ${p.skills.join(", ")}` : ""}</option>
            ))}
          </Select>
        </Field>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}Submit for approval
        </Button>
        <ButtonLink href="/jobs" variant="secondary">Cancel</ButtonLink>
      </div>
    </form>
  );
}
