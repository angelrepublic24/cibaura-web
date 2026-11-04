import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { moderationService } from "@/modules/moderation/services/moderation.service";
import { carKeys } from "@/modules/cars/hooks/cars.hook";
import type {
  AdminReportsQuery,
  BlockSubjectInput,
  BlockSubjectType,
  FileReportInput,
  MyBlocks,
  ResolveReportInput,
} from "@/modules/moderation/types/moderation.types";
import { API_ERROR_CODES, isApiErrorCode } from "@/shared/api/errors";

/** Query keys for the moderation module (the only cache it owns). */
export const moderationKeys = {
  all: ["moderation"] as const,
  reasons: () => ["moderation", "reasons"] as const,
  blocks: () => ["moderation", "blocks"] as const,
  adminReports: (query: AdminReportsQuery = {}) =>
    ["moderation", "admin", "reports", query] as const,
  adminReport: (id: string) =>
    ["moderation", "admin", "report", id] as const,
};

// ── User surface ────────────────────────────────────────────────────────────

/**
 * The reason lists. Fetched only while a report dialog is actually open
 * (`enabled`), and cached for the session: which reasons an object may carry
 * is a deployment-level fact, not something that changes mid-visit.
 */
export function useReportReasons(enabled: boolean) {
  return useQuery({
    queryKey: moderationKeys.reasons(),
    queryFn: () => moderationService.reportReasons(),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * File a report. Nothing in the UI reflects a filed report — the reporter
 * cannot read the queue by design — so there is no cache to update and no
 * follow-up to promise. The dialog shows the acknowledgement and closes.
 */
export function useFileReport() {
  return useMutation({
    mutationFn: (input: FileReportInput) => moderationService.fileReport(input),
  });
}

/** Everything this user has blocked. Idle for guests — it would only 401. */
export function useMyBlocks(enabled = true) {
  return useQuery({
    queryKey: moderationKeys.blocks(),
    queryFn: () => moderationService.myBlocks(),
    enabled,
  });
}

/**
 * Blocking an AGENCY changes what `GET /cars/search` and `/cars/catalog`
 * return for this viewer — the backend filters their cars out of `items` AND
 * the facets. So the listing caches must go, in both directions: blocking
 * must make the cars disappear and un-blocking must bring them back, without
 * a reload. This is what makes the copy's promise true instead of decorative.
 *
 * Blocking a PERSON does not touch the catalog (a renter has no listings),
 * but the invalidation is harmless and keeping one code path is worth more
 * than saving a refetch nobody notices.
 */
function invalidateBlockEffects(
  qc: ReturnType<typeof useQueryClient>,
): void {
  void qc.invalidateQueries({ queryKey: moderationKeys.blocks() });
  void qc.invalidateQueries({ queryKey: carKeys.all });
}

/**
 * Block an agency or a person.
 *
 * A DUPLICATE BLOCK IS NOT A FAILURE. `POST /blocks` answers 409
 * `BLOCK_EXISTS` when the block is already there, but the user's intent —
 * "I don't want to see this" — is satisfied either way, so the caller is told
 * it worked. Any other error is a real error. (`DELETE` needs no such
 * handling: it is 204 even when there was nothing to remove.)
 */
export function useBlockSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BlockSubjectInput) => {
      try {
        await moderationService.block(input);
      } catch (error) {
        if (!isApiErrorCode(error, API_ERROR_CODES.BLOCK_EXISTS)) throw error;
      }
    },
    onSuccess: () => invalidateBlockEffects(qc),
  });
}

/**
 * Un-block, OPTIMISTICALLY: the row leaves the list the instant it is
 * pressed instead of after a round trip (the pattern in
 * `modules/favorites/hooks/favorites.hook.ts`). The previous lists are kept
 * and restored if the write somehow fails.
 *
 * The row's own array decides the route: `agencies` → `/blocks/agency/:id`,
 * `people` → `/blocks/user/:id`.
 */
export function useUnblockSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { subjectType: BlockSubjectType; subjectId: string }) =>
      moderationService.unblock(input.subjectType, input.subjectId),
    onMutate: async ({ subjectType, subjectId }) => {
      await qc.cancelQueries({ queryKey: moderationKeys.blocks() });
      const prev = qc.getQueryData<MyBlocks>(moderationKeys.blocks());
      if (prev) {
        qc.setQueryData<MyBlocks>(moderationKeys.blocks(), {
          agencies:
            subjectType === "agency"
              ? prev.agencies.filter((a) => a.id !== subjectId)
              : prev.agencies,
          people:
            subjectType === "user"
              ? prev.people.filter((p) => p.id !== subjectId)
              : prev.people,
        });
      }
      return { prev };
    },
    onError: (_error, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(moderationKeys.blocks(), ctx.prev);
    },
    onSettled: () => invalidateBlockEffects(qc),
  });
}

// ── Admin surface ───────────────────────────────────────────────────────────

/**
 * The moderation queue. `placeholderData: keepPreviousData` so paging and
 * switching tabs keeps the table on screen (dimmed via `isFetching`) instead
 * of collapsing to skeletons on every click.
 */
export function useAdminReports(query: AdminReportsQuery) {
  return useQuery({
    queryKey: moderationKeys.adminReports(query),
    queryFn: () => moderationService.listReports(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminReport(reportId: string) {
  return useQuery({
    queryKey: moderationKeys.adminReport(reportId),
    queryFn: () => moderationService.getReport(reportId),
    enabled: !!reportId,
  });
}

/**
 * Move one report. The response IS the moved report, so it seeds the detail
 * cache directly; the queue is invalidated because the row has very likely
 * left the tab it was read from.
 */
export function useResolveReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveReportInput) =>
      moderationService.resolveReport(reportId, input),
    onSuccess: (resolved) => {
      qc.setQueryData(moderationKeys.adminReport(reportId), resolved);
      void qc.invalidateQueries({
        queryKey: ["moderation", "admin", "reports"],
      });
    },
  });
}
