// Shown in Africa/Johannesburg time (UTC+2, no DST), matching the office app.
const time = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false });
const day = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" });

export const fmtTime = (iso: string) => time.format(new Date(iso));

export function fmtSlot(start: string | null, end: string | null) {
  if (!start) return "No time set";
  const d = new Date(start);
  const today = day.format(d) === day.format(new Date());
  return `${today ? "" : day.format(d) + ", "}${fmtTime(start)}${end ? ` to ${fmtTime(end)}` : ""}`;
}
