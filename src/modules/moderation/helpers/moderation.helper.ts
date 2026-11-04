import type {
  ReportStatus,
  ReportTargetType,
  ResolveReportStatus,
} from "@/modules/moderation/types/moderation.types";
import type { Role } from "@/shared/types/domain";

/**
 * WHO THE MODERATION API SERVES. Every route of the backend's
 * `ModerationController` — the reason lists, `POST /reports`, `POST /blocks`,
 * `DELETE /blocks/:type/:id` and `GET /blocks` — carries the same
 * `@Auth(CUSTOMER, AGENCY_OWNER, AGENCY_STAFF)`.
 *
 * A platform_admin is deliberately absent: admins READ the queue through
 * `/admin/reports` and never file into it, so every one of those routes
 * answers them 403. Any surface that offers reporting, blocking or the
 * blocked list must gate on THIS, not on "is signed in".
 *
 * It is a ROLE list, not a permission: `reports:view` is about business
 * reporting (revenue, bookings) and has nothing to do with moderation.
 */
export const MODERATION_ROLES: readonly Role[] = [
  "customer",
  "agency_owner",
  "agency_staff",
];

/** Whether a user's roles include one the moderation API serves. */
export function rolesCanModerate(roles: readonly Role[] | undefined): boolean {
  if (!roles) return false;
  return MODERATION_ROLES.some((role) => roles.includes(role));
}

/**
 * Readable English for the moderation wire values. The API sends slugs and
 * says so: the reason LISTS come from `GET /reports/reasons`, the labels are
 * the client's to write.
 */

/**
 * The reason slugs this client has written copy for (backend
 * `ReportReason`). Not a wire contract — a value outside this set still
 * renders, de-slugified, instead of breaking the dialog.
 */
const REPORT_REASON_LABELS: Readonly<Record<string, string>> = {
  not_as_described: "Not as described",
  offensive: "Offensive or inappropriate",
  harassment: "Harassment",
  misleading: "Misleading information",
  scam: "Scam or fraud",
  other: "Something else",
};

/** One line of help under each reason, so the choice is not a guess. */
const REPORT_REASON_HINTS: Readonly<Record<string, string>> = {
  not_as_described: "The car, its photos or its specs do not match reality.",
  offensive: "Offensive, hateful or sexual content.",
  harassment: "Repeated unwanted contact, threats or intimidation.",
  misleading: "Claims that are untrue or hide something important.",
  scam: "An attempt to take money or data off the platform.",
  other: "Anything else our team should look at.",
};

/**
 * `not_as_described` → "Not as described". An UNKNOWN slug is de-slugified
 * and sentence-cased (`spare_tyre` → "Spare tyre") rather than mapped onto
 * some other reason — which is the whole point of `reason` being an open
 * string on the wire.
 */
export function reportReasonLabel(reason: string): string {
  const known = REPORT_REASON_LABELS[reason];
  if (known) return known;
  // An unfamiliar slug: show it readably rather than raw or blank.
  const spaced = reason.replace(/[_-]+/g, " ").trim();
  if (!spaced) return "Other";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The help line for a reason, or undefined when we have none to offer. */
export function reportReasonHint(reason: string): string | undefined {
  return REPORT_REASON_HINTS[reason];
}

/** What the reporter is reporting, for the dialog title. */
export function reportTargetNoun(targetType: ReportTargetType): string {
  switch (targetType) {
    case "car":
      return "listing";
    case "agency":
      return "agency";
    case "message":
      return "message";
    case "user":
      return "person";
  }
}

/** Admin queue tab + badge copy. */
export function reportStatusLabel(status: ReportStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "reviewing":
      return "Reviewing";
    case "actioned":
      return "Actioned";
    case "dismissed":
      return "Dismissed";
  }
}

/*
 * NO `blockSubjectLabel` HERE, deliberately. There was one — it returned
 * "person" for `subjectType: "user"` while its own docblock called the result
 * "the un-block route segment", which would have built
 * `DELETE /blocks/person/:id` and met the controller's
 * `ParseEnumPipe(BlockSubjectType)` as a 400: a block nobody could lift.
 *
 * The un-block path is never derived from a label. The ARRAY a row arrived in
 * is its subject type, and that pairing is wired exactly twice — in
 * `/account/blocked` and in `useUnblockSubject` — straight from the wire
 * values `agency` / `user`.
 */

/**
 * Where a report may go next — the client half of the backend's
 * `ALLOWED_REPORT_TRANSITIONS`:
 *
 *   open      → reviewing | actioned | dismissed
 *   reviewing →             actioned | dismissed
 *   actioned  → ∅   (a decision is final)
 *   dismissed → ∅
 *
 * Mirrored here so the UI offers only what will be accepted; the server
 * remains the authority and answers 409 `REPORT_NOT_OPEN` otherwise —
 * including the race where another admin decided the same row first.
 */
export function allowedReportTransitions(
  from: ReportStatus,
): readonly ResolveReportStatus[] {
  switch (from) {
    case "open":
      return ["reviewing", "actioned", "dismissed"];
    case "reviewing":
      return ["actioned", "dismissed"];
    case "actioned":
    case "dismissed":
      return [];
  }
}

/** True once a report is decided: nothing further can move it. */
export function isReportDecided(status: ReportStatus): boolean {
  return status === "actioned" || status === "dismissed";
}

/**
 * The statuses that END a report. `reviewing` is NOT one: it only records
 * that somebody picked the report up, needs no note and leaves `resolvedAt`
 * null.
 */
export function isClosingReportStatus(
  status: ResolveReportStatus,
): status is "actioned" | "dismissed" {
  return status === "actioned" || status === "dismissed";
}

/** What each transition means, in the admin's own terms. */
export function resolveStatusCopy(status: ResolveReportStatus): {
  label: string;
  hint: string;
} {
  switch (status) {
    case "reviewing":
      return {
        label: "I am looking at this",
        hint: "Marks the report as taken so another admin does not duplicate the work. No note needed, and it keeps any note already on the report.",
      };
    case "actioned":
      return {
        label: "Actioned — we did something",
        hint: "Final. Say what you did: suspending an agency or pulling a listing happens through the normal admin screens, and this note is the record of it.",
      };
    case "dismissed":
      return {
        label: "Dismissed — nothing to do",
        hint: "Final. Say why, so the next report about the same thing can be judged against it.",
      };
  }
}
