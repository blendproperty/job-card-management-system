import { offlineAccount, readOffline, writeOffline } from "./offline";
import type { FieldJob } from "./types";
import { nextAction, completionBlockers } from "./types";
import { ApiError, sync, upload, type Op, type OpResult } from "./api";

type Upload = { attachment_id: string; path: string; body: ArrayBuffer; content_type: string };
type Item = { op: Op; upload?: Upload };

let items: Item[] = [];
let flushing: Promise<FlushResult> | null = null;
const listeners = new Set<(n: number) => void>();
const notify = () => listeners.forEach((l) => l(items.length));

export const pendingCount = () => items.length;
export function onPending(fn: (n: number) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export type FlushResult = { offline: boolean; rejected: OpResult[] };

export async function restoreOutbox() {
  const owner = offlineAccount();
  const saved = await readOffline<Item[]>("outbox");
  if (owner !== offlineAccount()) return;
  items = saved ?? [];
  notify();
}

export function withPending(job: FieldJob): FieldJob {
  const attachments = [...job.attachments];
  let stage = job.stage;
  for (const { op } of items) {
    if (op.job_id !== job.id) continue;
    if (op.type === "status") stage = op.to;
    if (op.type === "attachment" && !attachments.some((a) => a.id === op.attachment_id)) {
      attachments.push({ id: op.attachment_id, kind: op.kind, stage: op.stage, taken_at: op.taken_at,
        uploaded_at: null, signer_name: op.signer_name ?? null });
    }
  }
  return { ...job, stage, attachments, next: nextAction(stage), blockers: completionBlockers(attachments) };
}

export async function enqueue(op: Op, up?: Upload): Promise<FlushResult> {
  items.push({ op, upload: up });
  try {
    await writeOffline("outbox", items.slice());
  } catch {
    items = items.filter((item) => item.op.op_id !== op.op_id);
    return { offline: false, rejected: [{ op_id: op.op_id, status: "rejected", reason: "Could not save this change on the device. Free up storage and try again." }] };
  }
  notify();
  return flush();
}

export function flush(): Promise<FlushResult> {
  if (flushing) return flushing;
  // Clear the slot in .finally *after* assignment: with an empty queue the async body completes
  // synchronously, so a `finally` inside it would run before `flushing` is set and leave it stale.
  const run: Promise<FlushResult> = (async () => {
    const owner = offlineAccount();
    const rejected: OpResult[] = [];
    try {
      while (owner === offlineAccount() && items.length) {
        const item = items[0];
        const { results } = await sync([item.op]);
        if (owner !== offlineAccount()) return { offline: false, rejected };
        const r = results[0];
        if (r.status === "rejected") rejected.push(r);
        else if (item.upload) await upload(item.upload.attachment_id, item.upload.path, item.upload.body, item.upload.content_type);
        if (owner !== offlineAccount()) return { offline: false, rejected };
        items.shift();
        await writeOffline("outbox", items.slice()).catch(() => undefined);
        notify();
      }
      return { offline: false, rejected };
    } catch (e) {
      if (owner !== offlineAccount()) return { offline: false, rejected };
      if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 401) return { offline: true, rejected };
      // Server refused the item outright (e.g. 422 on upload): drop it and report.
      const dropped = items.shift();
      await writeOffline("outbox", items.slice()).catch(() => undefined);
      notify();
      rejected.push({ op_id: dropped?.op.op_id ?? "", status: "rejected", reason: (e as Error).message });
      return { offline: false, rejected };
    }
  })();
  flushing = run;
  run.finally(() => { if (flushing === run) flushing = null; });
  return run;
}

export function clearOutbox() {
  flushing = null;
  items = [];
  notify();
}
