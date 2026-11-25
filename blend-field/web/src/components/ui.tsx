import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Stage } from "@/server/types";
import { STAGE_LABEL } from "@/server/stages";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ───────── Button (components.md: Button) ─────────
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-bg text-text border border-border-input hover:bg-surface",
  ghost: "bg-transparent text-text hover:bg-surface",
  danger: "bg-danger text-on-danger hover:opacity-90",
};
const SIZE: Record<Size, string> = { sm: "h-8 px-3", md: "h-10 px-4", lg: "h-12 px-5 text-base" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold text-sm whitespace-nowrap",
    "transition-colors duration-[var(--motion-fast)] active:translate-y-px",
    "disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4",
    VARIANT[variant], SIZE[size], extra,
  );
}

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...p} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant, size, className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...p} className={buttonClass(variant, size, className)} />;
}

// ───────── Field / Input / Select (components.md: Input, Select) ─────────
export function Field({ label, htmlFor, required, help, error, children }: {
  label: string; htmlFor: string; required?: boolean; help?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
        {required && <span className="ml-1 text-xs font-medium text-text-muted">Required</span>}
      </label>
      {children}
      {help && !error && <p id={`${htmlFor}-help`} className="text-xs text-text-muted">{help}</p>}
      {error && <p id={`${htmlFor}-error`} className="text-xs text-danger">{error}</p>}
    </div>
  );
}

const inputBase =
  "h-10 w-full rounded-sm border border-border-input bg-bg px-3 text-base text-text placeholder:text-text-subtle " +
  "focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus/35 aria-[invalid=true]:border-danger disabled:opacity-50";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={cx(inputBase, className)} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx(inputBase, "h-auto min-h-24 py-2", className)} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cx(inputBase, "pr-8", className)} />;
}

// ───────── StatusPill (components.md: Badge / StatusPill) ─────────
// Literal class strings so Tailwind's scanner picks them up.
const PILL: Record<Stage | "overdue", string> = {
  unassigned: "bg-status-unassigned-bg text-status-unassigned-fg [--dot:var(--color-status-unassigned-dot)]",
  assigned: "bg-status-assigned-bg text-status-assigned-fg [--dot:var(--color-status-assigned-dot)]",
  en_route: "bg-status-en-route-bg text-status-en-route-fg [--dot:var(--color-status-en-route-dot)]",
  arrived: "bg-status-arrived-bg text-status-arrived-fg [--dot:var(--color-status-arrived-dot)]",
  in_progress: "bg-status-in-progress-bg text-status-in-progress-fg [--dot:var(--color-status-in-progress-dot)]",
  pending: "bg-status-pending-bg text-status-pending-fg [--dot:var(--color-status-pending-dot)]",
  completed: "bg-status-completed-bg text-status-completed-fg [--dot:var(--color-accent)]",
  cancelled: "bg-status-cancelled-bg text-status-cancelled-fg [--dot:var(--color-status-cancelled-dot)]",
  overdue: "bg-status-overdue-bg text-status-overdue-fg [--dot:var(--color-status-overdue-dot)]",
};

export function StatusPill({ stage }: { stage: Stage | "overdue" }) {
  return (
    <span className={cx("inline-flex h-[22px] items-center gap-1.5 rounded-pill px-2.5 text-xs font-semibold whitespace-nowrap", PILL[stage])}>
      <span aria-hidden className="size-[7px] rounded-full bg-[var(--dot)]" />
      {stage === "overdue" ? "Overdue" : STAGE_LABEL[stage]}
    </span>
  );
}

// ───────── OutcomeBadge (components.md) ─────────
export function OutcomeBadge({ name, successful, comment }: { name: string; successful: boolean; comment?: string | null }) {
  return (
    <span
      title={comment ?? undefined}
      aria-label={`Outcome: ${name} (${successful ? "done" : "not done"})`}
      className={cx(
        "inline-flex h-[22px] items-center gap-1 rounded-pill px-2.5 text-xs font-semibold whitespace-nowrap",
        successful ? "bg-outcome-done-bg text-outcome-done-fg" : "bg-outcome-failed-bg text-outcome-failed-fg",
      )}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {successful ? <path d="M3 8.5l3.2 3L13 4.5" /> : <path d="M4 4l8 8M12 4l-8 8" />}
      </svg>
      {name}
    </span>
  );
}

// ───────── Tabs as links (components.md: Tabs) ─────────
export function TabLinks({ tabs, current, label }: { tabs: { key: string; label: string; count?: number; href: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {tabs.map((t) => {
        const on = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5",
              on ? "border-accent-text font-semibold text-text" : "border-transparent font-medium text-text-muted hover:text-text",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx("rounded-pill px-1.5 text-xs font-semibold", on ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-text-muted")}>
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

// ───────── EmptyState ─────────
export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
      <div className="mx-auto mb-3 flex justify-center text-text-subtle [&_svg]:size-12" aria-hidden>{icon}</div>
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 mb-4 text-text-muted">{hint}</p>
      {action}
    </div>
  );
}

// ───────── EngineerChip ─────────
export function initials(name: string) {
  return name.replace(/\(.*?\)/g, "").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
export function EngineerChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="grid size-[26px] place-items-center rounded-full bg-surface-2 text-[11px] font-bold">{initials(name)}</span>
      {name}
    </span>
  );
}

export function Card({ className, ...p }: ComponentProps<"section">) {
  return <section {...p} className={cx("rounded-lg border border-border bg-bg p-5", className)} />;
}
