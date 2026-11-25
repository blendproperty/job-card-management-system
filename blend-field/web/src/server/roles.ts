import type { Role } from "./types";

export const managerRoles = ["facility_manager", "asset_manager", "property_manager"] as const;
export const roleLabels: Record<Role | "tenant", string> = {
  admin: "Administrator",
  office: "Office",
  facility_manager: "Facilities Manager",
  asset_manager: "Asset Manager",
  property_manager: "Property Manager",
  engineer: "Engineer",
  contractor: "Contractor",
  tenant: "Tenant",
};

export const isOfficeRole = (role: Role) => role === "admin" || role === "office" || managerRoles.some((manager) => manager === role);
