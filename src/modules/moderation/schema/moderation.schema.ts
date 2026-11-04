import { z } from "zod";
import { paginatedWireSchema } from "@/shared/api/wire";

/**
 * Moderation wire schemas (zod v4). `ModerationService` validates every
 * response against these; the `z.infer` types live in
 * `../types/moderation.types`.
 *
 * TYPING RULE APPLIED HERE — enums where the CLIENT BRANCHES, open strings
 * where it only renders:
 *
 *  - `targetType` and `status` are closed enums: the client switches on them
 *    to pick a dialog, build the un-block path and choose a badge. A value
 *    outside the set is a real client bug, and failing loudly is correct.
 *  - `reason` is a plain string. The per-target lists are SERVED by
 *    `GET /reports/reasons` precisely so they can change without a web
 *    deploy; pinning the union here would re-hardcode the thing that
 *    endpoint exists to avoid, and a seventh reason added server-side would
 *    then blow up the whole dialog instead of rendering one unfamiliar row.
 *    `reportReasonLabel()` in `../helpers` labels the known slugs and
 *    de-slugifies anything else.
 */

/** What can be reported. `targetId` is an agencies/cars/messages/users id. */
export const REPORT_TARGET_TYPES = [
  "agency",
  "car",
  "message",
  "user",
] as const;
export const reportTargetTypeSchema = z.enum(REPORT_TARGET_TYPES);

/** What can be blocked — a storefront, or a person. No `car` here. */
export const BLOCK_SUBJECT_TYPES = ["agency", "user"] as const;
export const blockSubjectTypeSchema = z.enum(BLOCK_SUBJECT_TYPES);

/** The report lifecycle (backend `ReportStatus`). */
export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "actioned",
  "dismissed",
] as const;
export const reportStatusSchema = z.enum(REPORT_STATUSES);

/**
 * The statuses an admin may MOVE a report to. `open` is absent on purpose:
 * the backend DTO refuses it outright (400) and the transition table refuses
 * it again behind that, so offering it would be offering a known failure.
 */
export const RESOLVE_REPORT_STATUSES = [
  "reviewing",
  "actioned",
  "dismissed",
] as const;
export const resolveReportStatusSchema = z.enum(RESOLVE_REPORT_STATUSES);

/** Open on purpose — see the typing rule above. */
export const reportReasonSchema = z.string().min(1);

/** Longest free-text a reporter may add (backend `REPORT_DETAIL_MAX`). */
export const REPORT_DETAIL_MAX = 1000;
/** Resolution note bounds (backend `ResolveReportDto`: 2..1000). */
export const RESOLUTION_NOTE_MIN = 2;
export const RESOLUTION_NOTE_MAX = 1000;

// ── User surface ────────────────────────────────────────────────────────────

/**
 * `GET /reports/reasons` — the reasons each kind of object may carry, IN THE
 * ORDER THE UI MUST SHOW THEM. Every target type is always present.
 */
export const reportReasonsWireSchema = z.object({
  car: z.array(reportReasonSchema),
  agency: z.array(reportReasonSchema),
  message: z.array(reportReasonSchema),
  user: z.array(reportReasonSchema),
});

/**
 * `POST /reports` body. The global ValidationPipe is
 * `whitelist + forbidNonWhitelisted`, so an extra key is a 400 with NO code:
 * this object strips unknown keys (zod's default) and the service parses the
 * input through it before sending.
 */
export const fileReportInputSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  /** Omitted entirely when blank — never sent as an empty string. */
  detail: z.string().trim().max(REPORT_DETAIL_MAX).optional(),
});

/**
 * `POST /reports` → `{ id, status }` and deliberately nothing else: the
 * reporter never reads the moderation queue, so there is nothing to follow.
 */
export const reportFiledWireSchema = z.object({
  id: z.string(),
  status: reportStatusSchema,
});

/** `POST /blocks` body. */
export const blockSubjectInputSchema = z.object({
  subjectType: blockSubjectTypeSchema,
  subjectId: z.string().uuid(),
});

/** `POST /blocks` → the new block's id. Nothing else is useful to a client. */
export const blockCreatedWireSchema = z.object({
  id: z.string(),
});

/** One blocked storefront. `slug` is what links back to its public page. */
export const blockedAgencyWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  /** ISO-8601 instant the block was created. */
  blockedAt: z.string(),
});

/** One blocked person. No slug: people have no public page. */
export const blockedPersonWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  blockedAt: z.string(),
});

/**
 * `GET /blocks` — both lists, most recent first, either one possibly empty.
 *
 * THE ARRAY A ROW ARRIVES IN *IS* ITS `subjectType` for undoing:
 * `agencies[i]` → `DELETE /blocks/agency/{id}`, `people[i]` →
 * `DELETE /blocks/user/{id}`. A block whose subject no longer exists is not
 * listed at all, so every row here is undoable.
 */
export const myBlocksWireSchema = z.object({
  agencies: z.array(blockedAgencyWireSchema),
  people: z.array(blockedPersonWireSchema),
});

// ── Admin surface ───────────────────────────────────────────────────────────

/** Who filed it. The backend never sends the reporter's email. */
export const reportReporterWireSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** One row of `GET /admin/reports`. */
export const adminReportWireSchema = z.object({
  id: z.string(),
  targetType: reportTargetTypeSchema,
  /** Readable label ready to paint ("car listing", "chat message"…). */
  targetTypeLabel: z.string(),
  targetId: z.string(),
  reason: reportReasonSchema,
  /** Trimmed server-side; null when the reporter only picked a reason. */
  detail: z.string().nullable(),
  status: reportStatusSchema,
  reporter: reportReporterWireSchema,
  /** Who moved it last — including an admin who only picked it up. */
  resolvedByUserId: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  /** Stamped by a CLOSING transition only; null while open/reviewing. */
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * `GET /admin/reports/:reportId` — the row plus what only the detail read
 * pays for.
 *
 * `pendingReportsOnTarget` counts open+reviewing reports on the SAME object,
 * this one included, so it is always >= 1. It is deliberately absent from the
 * list endpoint: the backend has no index with `(target_type, target_id)` as
 * a prefix, so it is one count per row — cheap for one report, not for twenty.
 */
export const adminReportDetailWireSchema = adminReportWireSchema.extend({
  /**
   * The reported thing, named: a car with its host, an agency, a user, or
   * `Host: <message text>`. Null when the object no longer exists.
   *
   * For a message this carries PRIVATE CHAT TEXT (truncated server-side).
   * Never log it and never attach it to an error report.
   */
  targetLabel: z.string().nullable(),
  pendingReportsOnTarget: z.number(),
});

export const adminReportPageWireSchema = paginatedWireSchema(
  adminReportWireSchema,
);

/**
 * `GET /admin/reports` query. `page`/`pageSize` are `@IsInt()` server-side,
 * so they travel as numbers; omitting `status` means every status.
 */
export const adminReportsQuerySchema = z.object({
  status: reportStatusSchema.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

/**
 * `POST /admin/reports/:reportId/resolve` body.
 *
 * The note is OPTIONAL here because `reviewing` ("I picked this up") does not
 * need one — and sending a blank one would not satisfy a closing transition
 * anyway (400 `REPORT_RESOLUTION_NOTE_REQUIRED`). The dialog is what requires
 * it for `actioned`/`dismissed`, before the request leaves.
 */
export const resolveReportInputSchema = z.object({
  status: resolveReportStatusSchema,
  note: z
    .string()
    .trim()
    .min(RESOLUTION_NOTE_MIN)
    .max(RESOLUTION_NOTE_MAX)
    .optional(),
});
