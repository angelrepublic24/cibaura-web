"use client";

import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "./api";
import type { AgencyPermission, BranchScope, StaffRole } from "./rbac";

export interface UsePermission {
  /** True while the session is being fetched for the first time — gate on this to avoid flicker. */
  isLoading: boolean;
  /**
   * No session data yet (first load, or the read failed before any data
   * landed). Permissions are UNKNOWN here — render a loading block, never
   * a "forbidden" one.
   */
  isPending: boolean;
  /** The session read failed: permissions are unknown, NOT denied. */
  isError: boolean;
  error: unknown;
  /** Re-run the session read (the "Try again" of an error block). */
  refetch: () => void;
  role: StaffRole | undefined;
  branchScope: BranchScope | undefined;
  /** Whether the current user holds a permission (owner → always true). */
  can: (permission: AgencyPermission) => boolean;
}

/**
 * Reads the caller's agency permission context from `GET /agency/session`
 * (owner → all permissions). Drives every agency-side permission gate. The
 * server is always the real authority — this only decides what to render.
 *
 * `can` is false until the session has loaded (fail closed), so callers
 * that would show a "no access" message must check `isPending`/`isError`
 * first: an unanswered or failed read is not a denial.
 */
export function usePermission(): UsePermission {
  const query = useQuery({
    queryKey: agencyKeys.session(),
    queryFn: () => AgencyApi.session(),
    staleTime: 60_000,
  });

  const granted = new Set<AgencyPermission>(
    query.data?.membership.permissions ?? [],
  );

  return {
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    role: query.data?.membership.role,
    branchScope: query.data?.membership.branchScope,
    can: (permission) => granted.has(permission),
  };
}
