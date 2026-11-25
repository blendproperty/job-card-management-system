import { ApiError, sync, upload, type Op, type OpResult } from "./api";

/**
 * M0 outbox: ops and uploads queue in memory and replay in order. Device-generated ids make
 * replays safe (server returns "duplicate"). M1 swaps this for PowerSync's persistent queue.
 */
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

export function enqueue(op: Op, up?: Upload) {
  items.push({ op, upload: up });
  notify();
  return flush();
}

export function flush(): Promise<FlushResult> {
  if (flushing) return flushing;
  // Clear the slot in .finally *after* assignment: with an empty queue the async body completes
  // synchronously, so a `finally` inside it would run before `flushing` is set and leave it stale.
  const run: Promise<FlushResult> = (async () => {
    const rejected: OpResult[] = [];
    try {
      while (items.length) {
        const item = items[0];
        const { results } = await sync([item.op]);
        const r = results[0];
        if (r.status === "rejected") rejected.push(r);
        else if (item.upload) await upload(item.upload.attachment_id, item.upload.path, item.upload.body, item.upload.content_type);
        items.shift();
        notify();
      }
      return { offline: false, rejected };
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) return { offline: true, rejected };
      // Server refused the item outright (e.g. 422 on upload): drop it and report.
      const dropped = items.shift();
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
  items = [];
  notify();
}
