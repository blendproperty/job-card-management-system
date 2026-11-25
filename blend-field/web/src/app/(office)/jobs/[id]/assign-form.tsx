"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { assignJobAction, type FormState } from "../../../actions";

export function AssignForm({ jobId, current, people }: { jobId: string; current?: string; people: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(assignJobAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <label htmlFor="member_id" className="text-xs font-semibold text-text-muted">{current ? "Reassign to" : "Assign to"}</label>
      <div className="flex gap-2">
        <Select id="member_id" name="member_id" defaultValue={current ?? ""} required aria-invalid={!!state?.error} aria-describedby={state?.error ? "assign-error" : undefined}>
          <option value="" disabled>Choose someone</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}{current ? "Reassign" : "Assign"}
        </Button>
      </div>
      {state?.error && <p id="assign-error" role="alert" className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
