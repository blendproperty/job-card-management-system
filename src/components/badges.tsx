import { cx } from "@/lib/format";
import {
  INSPECTION_STATUSES,
  JOB_PRIORITIES,
  JOB_STATUSES,
  JOB_STATUS_TONE,
  STATUS_TONE,
  type InspectionStatus,
  type JobPriority,
  type JobStatus,
} from "@/lib/options";

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

export const InspectionStatusBadge = ({ status }: { status: InspectionStatus }) => (
  <span className={cx(base, STATUS_TONE[status])}>{INSPECTION_STATUSES[status]}</span>
);
export const JobStatusBadge = ({ status }: { status: JobStatus }) => (
  <span className={cx(base, JOB_STATUS_TONE[status])}>{JOB_STATUSES[status]}</span>
);
export const PriorityBadge = ({ priority }: { priority: JobPriority }) => (
  <span
    className={cx(
      base,
      priority === "urgent" ? "bg-rose-600 text-white" : priority === "high" ? "bg-orange-100 text-orange-800" : "bg-stone-100 text-stone-600",
    )}
  >
    {JOB_PRIORITIES[priority]}
  </span>
);
