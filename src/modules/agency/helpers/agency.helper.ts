import type {
  AgencyCar,
  MediaKind,
  MediaLabel,
  OccupancyEntry,
} from "@/shared/types/domain";
import { AGENCY_PERMISSIONS } from "@/modules/agency/schema/agency.schema";
import type {
  AgencyPermission,
  AssignableRole,
  BranchScope,
} from "@/modules/agency/types/agency.types";

/**
 * Pure agency helpers: the RBAC labels and bundles, the presentation-side
 * branch scoping, and the client-side upload limits/validation. Nothing here
 * talks to the network or to React.
 */

// ── RBAC labels & bundles (ADR-0005 mirror; see `agency.schema`) ────────────

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

export { AGENCY_PERMISSIONS };

// ── Branch scope ────────────────────────────────────────────────────────────

/** Presentation defense only; the API must enforce the same scope. Unknown = closed. */
export function fleetForScope(
  cars: AgencyCar[],
  scope: BranchScope | undefined,
): AgencyCar[] {
  if (scope?.mode === "all") return cars;
  if (scope?.mode !== "branches") return [];
  const allowed = new Set(scope.branchIds);
  return cars.filter(
    (car) => Boolean(car.branchId) && allowed.has(car.branchId),
  );
}

export function occupancyForScope(
  entries: OccupancyEntry[],
  cars: AgencyCar[],
  scope: BranchScope | undefined,
): OccupancyEntry[] {
  if (scope?.mode === "all") return entries;
  const allowedCars = new Set(fleetForScope(cars, scope).map((car) => car.id));
  return entries.filter((entry) => allowedCars.has(entry.carId));
}

// ── Car photo uploads ───────────────────────────────────────────────────────

/** Client-side mirror of the backend caps (the server re-validates them). */
export const MAX_CAR_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per photo
export const MAX_PHOTOS_PER_CAR = 10;
export const ALLOWED_CAR_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Human-readable rejection reason, or null when the file is acceptable. The
 * server enforces the same rules — this only gives instant feedback.
 */
export function validateCarPhotoFile(file: File): string | null {
  if (!ALLOWED_CAR_PHOTO_TYPES.includes(file.type)) {
    return "Unsupported format — use JPEG, PNG or WEBP.";
  }
  if (file.size > MAX_CAR_PHOTO_BYTES) {
    return "Too large — photos must be 5 MB or smaller.";
  }
  return null;
}

// ── Inspection media (ADR-0011) ─────────────────────────────────────────────

/** Mirror of `common/upload/inspection-media.ts`; the server enforces these. */
export const MAX_INSPECTION_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_INSPECTION_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_INSPECTION_VIDEO_SECONDS = 30;
/** Per inspection, pending rows included. */
export const MAX_INSPECTION_PHOTOS = 30;
export const MAX_INSPECTION_VIDEOS = 4;

export const ALLOWED_INSPECTION_PHOTO_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const ALLOWED_INSPECTION_VIDEO_TYPES: readonly string[] = [
  "video/mp4",
  "video/quicktime",
];

/** The seven guided shots every inspection needs before submission. */
export const REQUIRED_INSPECTION_LABELS: readonly MediaLabel[] = [
  "front",
  "rear",
  "left",
  "right",
  "interior",
  "odometer",
  "fuel",
];

/** Human-readable rejection reason, or null when the file is acceptable. */
export function validateInspectionFile(
  kind: MediaKind,
  file: File,
): string | null {
  if (kind === "photo") {
    if (!ALLOWED_INSPECTION_PHOTO_TYPES.includes(file.type)) {
      return "Unsupported format — photos must be JPEG, PNG or WEBP.";
    }
    if (file.size > MAX_INSPECTION_PHOTO_BYTES) {
      return "Too large — photos must be 10 MB or smaller.";
    }
    return null;
  }
  if (!ALLOWED_INSPECTION_VIDEO_TYPES.includes(file.type)) {
    return "Unsupported format — videos must be MP4 or MOV.";
  }
  if (file.size > MAX_INSPECTION_VIDEO_BYTES) {
    return "Too large — videos must be 100 MB or smaller.";
  }
  return null;
}

/**
 * Duration of a video file in whole seconds, read from its metadata in a
 * detached `<video>` element (no network, no playback). Rejects when the
 * browser cannot decode the container.
 */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      cleanup();
      if (!Number.isFinite(seconds)) {
        reject(new Error("Could not read the video length."));
        return;
      }
      resolve(Math.ceil(seconds));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("This video could not be read by your browser."));
    };
    video.src = url;
  });
}
