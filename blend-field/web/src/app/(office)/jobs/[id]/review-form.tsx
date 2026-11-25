"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { reviewJobAction } from "../../../actions";

export function ReviewForm({ jobId, phase }: { jobId: string; phase: "dispatch" | "closure" }) {
  const [state, action, pending] = useActionState(reviewJobAction, undefined);
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      {phase === "dispatch" ? <>
        <Button type="submit" name="decision" value="approve" disabled={pending}>Approve and allocate</Button>
        <Button type="submit" name="decision" value="reject" disabled={pending} variant="secondary">Decline</Button>
      </> : <Button type="submit" name="decision" value="close" disabled={pending}>Close job</Button>}
      {state?.error && <p role="alert" className="w-full text-danger">{state.error}</p>}
    </form>
  );
}
