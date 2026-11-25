"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { FormError } from "@/components/form-error";
import { SignaturePad } from "@/components/signature-pad";
import {
  addEvidence,
  allocateJob,
  clarifyJob,
  closeJob,
  returnForClarification,
  returnForRework,
  saveWork,
  submitWork,
  type FormState,
} from "../actions";

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

function ActionForm({ id, action, children, className }: { id: string; action: Action; children: (pending: boolean) => React.ReactNode; className?: string }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className={className}>
      <input type="hidden" name="id" value={id} />
      <FormError error={state?.error} />
      {children(pending)}
    </form>
  );
}

export function ManagerApprove({ id, workers }: { id: string; workers: { id: string; name: string; role: string }[] }) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="space-y-3">
      <ActionForm id={id} action={allocateJob} className="space-y-2">
        {(p) => (
          <>
            <label className="label">Allocate to</label>
            <div className="flex flex-wrap gap-2">
              <select name="assigneeId" className="input flex-1" required defaultValue="">
                <option value="" disabled>Select team member</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.role === "staff" ? "Internal staff" : "Contractor"}</option>)}
              </select>
              <button className="btn-primary" disabled={p}>Approve and allocate</button>
            </div>
            {workers.length === 0 && <p className="text-xs text-stone-500">No active staff or contractors are linked to this property yet. Add them on the People page.</p>}
          </>
        )}
      </ActionForm>
      {asking ? (
        <ActionForm id={id} action={returnForClarification} className="space-y-2">
          {(p) => (
            <>
              <textarea name="reason" rows={2} className="input" placeholder="What do you need to know?" required />
              <div className="flex gap-2"><button className="btn-secondary" disabled={p}>Send back to requester</button><button type="button" className="btn-secondary" onClick={() => setAsking(false)}>Cancel</button></div>
            </>
          )}
        </ActionForm>
      ) : (
        <button className="text-sm text-stone-600 hover:text-ink" onClick={() => setAsking(true)}>Ask the requester for more detail</button>
      )}
    </div>
  );
}

export function RequesterClarify({ id }: { id: string }) {
  return (
    <ActionForm id={id} action={clarifyJob} className="space-y-2">
      {(p) => (
        <>
          <label className="label">Add the detail the manager asked for</label>
          <textarea name="detail" rows={3} className="input" required />
          <button className="btn-primary" disabled={p}>Resubmit</button>
        </>
      )}
    </ActionForm>
  );
}

export function WorkRecord({ id, minutes, overtime, notes }: { id: string; minutes: number; overtime: number; notes: string }) {
  return (
    <ActionForm id={id} action={saveWork} className="space-y-3">
      {(p) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Work minutes</label><input type="number" min={0} name="workMinutes" defaultValue={minutes} className="input" required /></div>
            <div><label className="label">Overtime minutes</label><input type="number" min={0} name="overtimeMinutes" defaultValue={overtime} className="input" required /></div>
          </div>
          <div><label className="label">Work completed</label><textarea name="workNotes" defaultValue={notes} rows={3} className="input" /></div>
          <button className="btn-secondary" disabled={p}>Save work record</button>
        </>
      )}
    </ActionForm>
  );
}

export function SubmitWork({ id }: { id: string }) {
  return <ActionForm id={id} action={submitWork}>{(p) => <button className="btn-primary" disabled={p}>Submit for review</button>}</ActionForm>;
}

export function ManagerReview({ id }: { id: string }) {
  const [rework, setRework] = useState(false);
  return (
    <div className="space-y-3">
      <ActionForm id={id} action={closeJob}>{(p) => <button className="btn-primary" disabled={p}>Approve and close</button>}</ActionForm>
      {rework ? (
        <ActionForm id={id} action={returnForRework} className="space-y-2">
          {(p) => (
            <>
              <textarea name="reason" rows={2} className="input" placeholder="Reason for rework" required />
              <div className="flex gap-2"><button className="btn-secondary" disabled={p}>Return for rework</button><button type="button" className="btn-secondary" onClick={() => setRework(false)}>Cancel</button></div>
            </>
          )}
        </ActionForm>
      ) : (
        <button className="btn-secondary" onClick={() => setRework(true)}>Return for rework</button>
      )}
    </div>
  );
}

export function PhotoUpload({ id, kind, label }: { id: string; kind: "before" | "after"; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          setBusy(true);
          setError(null);
          for (const file of files) {
            const fd = new FormData();
            fd.set("id", id);
            fd.set("kind", kind);
            fd.set("file", file);
            const res = await addEvidence(fd);
            if (res.error) setError(res.error);
          }
          setBusy(false);
          if (ref.current) ref.current.value = "";
        }}
      />
      <button type="button" className="btn-secondary w-full" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {label}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function SignEvidence({ id, kind, label }: { id: string; kind: "contractor_signature" | "tenant_signature"; label: string }) {
  const [open, setOpen] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button className="btn-secondary" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="space-y-2 rounded-lg bg-brand-50 p-4">
      <p className="text-sm font-medium">Draw your signature</p>
      <p className="text-xs text-stone-500">Your account and the time will be recorded with it.</p>
      <SignaturePad onChange={setSig} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => {
            if (!sig) return setError("Draw your signature first.");
            start(async () => {
              const blob = await (await fetch(sig)).blob();
              const fd = new FormData();
              fd.set("id", id);
              fd.set("kind", kind);
              fd.set("file", new File([blob], `${kind}.png`, { type: "image/png" }));
              const res = await addEvidence(fd);
              if (res.error) setError(res.error);
              else setOpen(false);
            });
          }}
        >
          Save signature
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
