"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { reviewJobAction } from "../../../actions";

export function ReviewForm({ jobId, phase, overtime = 0 }: { jobId: string; phase: "dispatch" | "closure"; overtime?: number }) {
  const [state, action, pending] = useActionState(reviewJobAction, undefined);
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      {phase === "dispatch" ? <>
        <Button type="submit" name="decision" value="approve" disabled={pending}>Approve and allocate</Button>
        <Button type="submit" name="decision" value="reject" disabled={pending} variant="secondary">Decline</Button>
      </> : overtime > 0 ? <>
        <Button type="submit" name="decision" value="close_approve_overtime" disabled={pending}>Approve {overtime} min overtime and close</Button>
        <Button type="submit" name="decision" value="close_decline_overtime" disabled={pending} variant="secondary">Decline overtime and close</Button>
      </> : <Button type="submit" name="decision" value="close" disabled={pending}>Close job</Button>}
      {state?.error && <p role="alert" className="w-full text-danger">{state.error}</p>}
    </form>
  );
}
