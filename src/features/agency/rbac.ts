import type { Agency } from "@/shared/types/domain";

/**
 * Frontend MIRROR of the backend agency RBAC model
 * (`backend/src/common/types/permissions.ts`). Keep the two in lockstep —
 * this is one of the ADR-0005 permission-mirror sites.
 */
export const AGENCY_PERMISSIONS = [
  "fleet:read",
  "fleet:write",
  "bookings:read",
  "bookings:handle",
  "calendar:manage",
  "branches:manage",
  "zones:manage",
  "wallet:view",
  "wallet:withdraw",
  "messages:handle",
  "staff:manage",
  "agency:settings",
  "reports:view",
] as const;

export type AgencyPermission = (typeof AGENCY_PERMISSIONS)[number];

export type StaffRole = "owner" | "manager" | "sales" | "custom";
/** Bundles assignable to staff (owner is implicit, never assigned). */
export type AssignableRole = "manager" | "sales" | "custom";

export type BranchScopeMode = "all" | "branches";

export interface BranchScope {
  mode: BranchScopeMode;
  branchIds: string[];
}

export interface PermissionContext {
  role: StaffRole;
  permissions: AgencyPermission[];
  branchScope: BranchScope;
}

export interface AgencySession {
  agency: Agency;
  membership: PermissionContext;
}

export interface StaffMember {
  /** The staff user's id. */
  id: string;
  name: string;
  email: string;
  role: AssignableRole;
  permissions: AgencyPermission[];
  branchScope: BranchScope;
  isActive: boolean;
  createdAt: string;
}

/** Human labels for the permission chips / checkboxes. */
export const PERMISSION_LABELS: Record<AgencyPermission, string> = {
  "fleet:read": "View fleet",
  "fleet:write": "Add & edit cars",
  "bookings:read": "View booking requests",
  "bookings:handle": "Accept / reject bookings",
  "calendar:manage": "Manage calendar & blocks",
  "branches:manage": "Manage branches",
  "zones:manage": "Manage delivery zones",
  "wallet:view": "View wallet",
  "wallet:withdraw": "Withdraw money",
  "messages:handle": "Handle messages",
  "staff:manage": "Manage staff",
  "agency:settings": "Agency settings",
  "reports:view": "View reports",
};

export const BUNDLE_LABELS: Record<AssignableRole, string> = {
  manager: "Manager",
  sales: "Sales",
  custom: "Custom",
};

export const BUNDLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  manager:
    "Runs day-to-day operations across the agency — fleet, bookings, calendar, branches, zones and wallet view. Cannot withdraw money, manage staff, or change agency settings.",
  sales:
    "Sells and schedules: views the fleet, handles booking requests, manages the calendar and messages. No access to money, fleet editing, branches, or staff.",
  custom: "Pick exactly which permissions this person gets.",
};

/** Mirror of PERMISSION_BUNDLES — drives the bundle preview in the staff form. */
export const BUNDLE_PERMISSIONS: Record<
  Exclude<AssignableRole, "custom">,
  AgencyPermission[]
> = {
  manager: [
    "fleet:read",
    "fleet:write",
    "bookings:read",
    "bookings:handle",
    "calendar:manage",
    "branches:manage",
    "zones:manage",
    "wallet:view",
    "messages:handle",
    "reports:view",
  ],
  sales: [
    "fleet:read",
    "bookings:read",
    "bookings:handle",
    "calendar:manage",
    "messages:handle",
  ],
};

/** Effective permissions a bundle grants (custom → the explicit list). */
export function permissionsForBundle(
  role: AssignableRole,
  custom: AgencyPermission[] = [],
): AgencyPermission[] {
  if (role === "custom") return custom;
  return [...BUNDLE_PERMISSIONS[role]];
}
