export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

export const PROPERTY_TYPES = ["House", "Apartment", "Townhouse", "Cluster", "Duplex", "Cottage", "Office", "Retail", "Industrial", "Building", "Estate", "Other"];
export const PROPERTY_STYLES = ["Freestanding", "Semi-detached", "Simplex", "Duplex", "Penthouse", "Ground floor", "Upper floor"];
export const FURNISHING = ["Unfurnished", "Semi-furnished", "Furnished"];

export const INSPECTION_TYPES = {
  move_in: "Move-in",
  move_out: "Move-out",
  interim: "Interim",
  routine: "Routine",
  standalone: "Standalone",
} as const;
export type InspectionType = keyof typeof INSPECTION_TYPES;

export const INSPECTION_STATUSES = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  in_review: "In review",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
} as const;
export type InspectionStatus = keyof typeof INSPECTION_STATUSES;

export const STATUS_TONE: Record<InspectionStatus, string> = {
  scheduled: "bg-sky-100 text-sky-800",
  in_progress: "bg-amber-100 text-amber-800",
  in_review: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  closed: "bg-stone-200 text-stone-700",
  cancelled: "bg-rose-100 text-rose-800",
};

export const SECTION_KINDS = {
  room: "Room",
  checklist: "Checklist",
  meters: "Meter readings",
  keys: "Keys",
  notes: "Notes",
} as const;
export type SectionKind = keyof typeof SECTION_KINDS;

export const CONTACT_ROLES = {
  tenant: "Tenant",
  landlord: "Landlord",
  agent: "Agent",
  witness: "Witness",
  other: "Other",
} as const;
export type ContactRole = keyof typeof CONTACT_ROLES;

export const ROLES = {
  admin: "Administrator",
  manager: "Facility manager",
  portfolio: "Portfolio manager",
  inspector: "Inspector",
  staff: "Internal staff",
  contractor: "Contractor",
  tenant: "Tenant",
} as const;
export type RoleKey = keyof typeof ROLES;
/** Roles limited to one property ("facility"). */
export const SCOPED_ROLES: RoleKey[] = ["manager", "portfolio", "staff", "contractor", "tenant"];

export const JOB_STATUSES = {
  awaiting_approval: "Awaiting approval",
  returned_for_clarification: "Returned for clarification",
  in_progress: "In progress",
  returned_for_rework: "Returned for rework",
  awaiting_final_approval: "Awaiting final approval",
  closed: "Closed",
} as const;
export type JobStatus = keyof typeof JOB_STATUSES;
export const JOB_STATUS_TONE: Record<JobStatus, string> = {
  awaiting_approval: "bg-amber-100 text-amber-800",
  returned_for_clarification: "bg-orange-100 text-orange-800",
  in_progress: "bg-sky-100 text-sky-800",
  returned_for_rework: "bg-rose-100 text-rose-800",
  awaiting_final_approval: "bg-violet-100 text-violet-800",
  closed: "bg-emerald-100 text-emerald-800",
};
export const JOB_PRIORITIES = { normal: "Normal", high: "High", urgent: "Urgent" } as const;
export type JobPriority = keyof typeof JOB_PRIORITIES;
export const EVIDENCE_KINDS = {
  before: "Before photo",
  after: "After photo",
  contractor_signature: "Contractor signature",
  tenant_signature: "Tenant signature",
} as const;
