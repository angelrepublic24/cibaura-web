import { Api } from "@/shared/api/client";
import {
  adminReportDetailWireSchema,
  adminReportPageWireSchema,
  adminReportsQuerySchema,
  blockCreatedWireSchema,
  blockSubjectInputSchema,
  fileReportInputSchema,
  myBlocksWireSchema,
  reportFiledWireSchema,
  reportReasonsWireSchema,
  resolveReportInputSchema,
} from "@/modules/moderation/schema/moderation.schema";
import type {
  AdminReportDetail,
  AdminReportsQuery,
  AdminReport,
  BlockCreated,
  BlockSubjectInput,
  BlockSubjectType,
  FileReportInput,
  MyBlocks,
  ReportFiled,
  ReportReasons,
  ResolveReportInput,
} from "@/modules/moderation/types/moderation.types";
import type { Paginated } from "@/shared/types/domain";

/**
 * Moderation API client — the ONLY thing in the module that talks to the
 * backend. Hooks call these, components call hooks.
 *
 * Backend routes (global `api/` prefix is in the axios baseURL):
 *
 *  USER — @Auth(customer, agency_owner, agency_staff)
 *  - GET    /reports/reasons                     -> ReportReasons
 *  - POST   /reports                             -> { id, status }
 *  - POST   /blocks                              -> { id }
 *  - DELETE /blocks/:subjectType/:subjectId      -> 204, idempotent
 *  - GET    /blocks                              -> { agencies, people }
 *
 *  ADMIN — @Auth(platform_admin)
 *  - GET    /admin/reports?status&page&pageSize   -> Paginated<AdminReport>
 *  - GET    /admin/reports/:reportId              -> AdminReportDetail
 *  - POST   /admin/reports/:reportId/resolve      -> AdminReportDetail
 *
 * Every REQUEST body is parsed through its input schema too, not only the
 * response: the global ValidationPipe is `whitelist + forbidNonWhitelisted`,
 * so one stray key answers 400 with no `code` for a caller to branch on.
 * Parsing here strips it before it can happen.
 */
class ModerationService {
  // ── User surface ──────────────────────────────────────────────────────────

  /**
   * The reason lists, per target type, IN UI ORDER. Never hardcode these in a
   * component: which reasons an object may carry is the server's decision.
   */
  async reportReasons(): Promise<ReportReasons> {
    const res = await Api.get<unknown>("/reports/reasons");
    return reportReasonsWireSchema.parse(res.data);
  }

  async fileReport(input: FileReportInput): Promise<ReportFiled> {
    const res = await Api.post<unknown>(
      "/reports",
      fileReportInputSchema.parse(input),
    );
    return reportFiledWireSchema.parse(res.data);
  }

  async block(input: BlockSubjectInput): Promise<BlockCreated> {
    const res = await Api.post<unknown>(
      "/blocks",
      blockSubjectInputSchema.parse(input),
    );
    return blockCreatedWireSchema.parse(res.data);
  }

  /**
   * Un-block. 204 ALWAYS, including when there was no block — so a caller
   * never has to handle "it was already gone" as a failure.
   */
  async unblock(
    subjectType: BlockSubjectType,
    subjectId: string,
  ): Promise<void> {
    await Api.delete(
      `/blocks/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}`,
    );
  }

  /** Everything this user has blocked, agencies and people, newest first. */
  async myBlocks(): Promise<MyBlocks> {
    const res = await Api.get<unknown>("/blocks");
    return myBlocksWireSchema.parse(res.data);
  }

  // ── Admin surface ─────────────────────────────────────────────────────────

  async listReports(
    query: AdminReportsQuery = {},
  ): Promise<Paginated<AdminReport>> {
    const res = await Api.get<unknown>("/admin/reports", {
      params: adminReportsQuerySchema.parse(query),
    });
    return adminReportPageWireSchema.parse(res.data);
  }

  async getReport(reportId: string): Promise<AdminReportDetail> {
    const res = await Api.get<unknown>(
      `/admin/reports/${encodeURIComponent(reportId)}`,
    );
    return adminReportDetailWireSchema.parse(res.data);
  }

  /**
   * Move a report: `reviewing` ("I took it", no note, `resolvedAt` stays
   * null) or `actioned`/`dismissed` (a decision — note required, stamps
   * `resolvedAt`, and the report is then FINAL). The response is the moved
   * report.
   */
  async resolveReport(
    reportId: string,
    input: ResolveReportInput,
  ): Promise<AdminReportDetail> {
    const res = await Api.post<unknown>(
      `/admin/reports/${encodeURIComponent(reportId)}/resolve`,
      resolveReportInputSchema.parse(input),
    );
    return adminReportDetailWireSchema.parse(res.data);
  }
}

export const moderationService = new ModerationService();
