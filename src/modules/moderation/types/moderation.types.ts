import type { z } from "zod";
import type {
  adminReportDetailWireSchema,
  adminReportsQuerySchema,
  adminReportWireSchema,
  blockCreatedWireSchema,
  blockedAgencyWireSchema,
  blockedPersonWireSchema,
  blockSubjectInputSchema,
  blockSubjectTypeSchema,
  fileReportInputSchema,
  myBlocksWireSchema,
  reportFiledWireSchema,
  reportReasonsWireSchema,
  reportReasonSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
  resolveReportInputSchema,
  resolveReportStatusSchema,
} from "@/modules/moderation/schema/moderation.schema";

/**
 * Moderation types — every one is the `z.infer` of a schema in `../schema`,
 * so the schema is the single source of truth.
 */

// ── Discriminators ──────────────────────────────────────────────────────────

export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type BlockSubjectType = z.infer<typeof blockSubjectTypeSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
/** The statuses an admin may move a report TO (never back to `open`). */
export type ResolveReportStatus = z.infer<typeof resolveReportStatusSchema>;
/**
 * A reason slug as the server sent it. Open by design — see the typing rule
 * in `../schema/moderation.schema.ts`.
 */
export type ReportReason = z.infer<typeof reportReasonSchema>;

// ── User surface ────────────────────────────────────────────────────────────

/** The per-target reason lists, in the order the UI must show them. */
export type ReportReasons = z.infer<typeof reportReasonsWireSchema>;
export type FileReportInput = z.infer<typeof fileReportInputSchema>;
export type ReportFiled = z.infer<typeof reportFiledWireSchema>;
export type BlockSubjectInput = z.infer<typeof blockSubjectInputSchema>;
export type BlockCreated = z.infer<typeof blockCreatedWireSchema>;
export type BlockedAgency = z.infer<typeof blockedAgencyWireSchema>;
export type BlockedPerson = z.infer<typeof blockedPersonWireSchema>;
/** Both block lists, as `GET /blocks` returns them. */
export type MyBlocks = z.infer<typeof myBlocksWireSchema>;

// ── Admin surface ───────────────────────────────────────────────────────────

export type AdminReport = z.infer<typeof adminReportWireSchema>;
export type AdminReportDetail = z.infer<typeof adminReportDetailWireSchema>;
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;
export type ResolveReportInput = z.infer<typeof resolveReportInputSchema>;
