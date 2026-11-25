// All times are stored UTC and shown in the org's zone (Africa/Johannesburg, no DST).
const TZ = "Africa/Johannesburg";

const time = new Intl.DateTimeFormat("en-ZA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dayTime = new Intl.DateTimeFormat("en-ZA", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtTime = (iso: string | null) => (iso ? time.format(new Date(iso)) : "–");
export const fmtDayTime = (iso: string | null) => (iso ? dayTime.format(new Date(iso)) : "–");

export function fmtSlot(start: string | null, end: string | null) {
  if (!start) return "Not scheduled";
  const sameDay = end && dayKey.format(new Date(start)) === dayKey.format(new Date(end));
  const today = dayKey.format(new Date(start)) === dayKey.format(new Date());
  const head = today ? `Today ${fmtTime(start)}` : fmtDayTime(start);
  return end ? `${head} to ${sameDay ? fmtTime(end) : fmtDayTime(end)}` : head;
}

export function fmtDuration(seconds: number | null) {
  if (seconds === null) return "–";
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "2026-11-20T10:30" in local SA time (from a datetime-local input) → UTC ISO. */
export function localInputToIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(`${v}:00+02:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** A job is overdue when its slot has ended and work hasn't finished. */
export function isOverdue(stage: string, end: string | null, now = Date.now()) {
  return !!end && Date.parse(end) < now && !["completed", "cancelled", "pending"].includes(stage);
}
