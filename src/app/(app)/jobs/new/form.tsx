"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError } from "@/components/form-error";
import { JOB_PRIORITIES } from "@/lib/options";
import { createJob } from "../actions";

export function NewJobForm({
  properties,
  prefill,
}: {
  properties: { id: string; label: string }[];
  prefill: { propertyId?: string; title?: string; location?: string; description?: string; itemId?: string; photos?: number };
}) {
  const [state, action, pending] = useActionState(createJob, undefined);
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-5">
      <FormError error={state?.error} />
      {prefill.itemId && (
        <>
          <input type="hidden" name="inspectionItemId" value={prefill.itemId} />
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Raised from an inspection.{prefill.photos ? ` ${prefill.photos} photo${prefill.photos > 1 ? "s" : ""} will be added as "before" evidence.` : ""}
          </p>
        </>
      )}
      <div>
        <label className="label">Issue title *</label>
        <input name="title" defaultValue={prefill.title} maxLength={120} className="input" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Property *</label>
          <select name="propertyId" defaultValue={prefill.propertyId ?? ""} className="input" required>
            <option value="" disabled>Choose a property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Unit, room or location *</label>
          <input name="location" defaultValue={prefill.location} maxLength={200} className="input" required placeholder="e.g. Unit 4, kitchen" />
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" defaultValue="normal" className="input">
            {Object.entries(JOB_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Needed by</label>
          <input type="date" name="dueDate" className="input" />
        </div>
      </div>
      <div>
        <label className="label">Describe the issue *</label>
        <textarea name="description" defaultValue={prefill.description} rows={5} maxLength={4000} className="input" required />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Submitting…" : "Submit request"}</button>
        <Link href="/jobs" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
