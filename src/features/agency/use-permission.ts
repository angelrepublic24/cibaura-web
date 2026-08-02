"use client";

import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "./api";
import type { AgencyPermission, BranchScope, StaffRole } from "./rbac";

export interface UsePermission {
  /** True while the session is loading — gate on this to avoid flicker. */
  isLoading: boolean;
  role: StaffRole | undefined;
  branchScope: BranchScope | undefined;
  /** Whether the current user holds a permission (owner → always true). */
  can: (permission: AgencyPermission) => boolean;
}

/**
 * Reads the caller's agency permission context from `GET /agency/session`
 * (owner → all permissions). Drives every agency-side permission gate. The
 * server is always the real authority — this only decides what to render.
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
    role: query.data?.membership.role,
    branchScope: query.data?.membership.branchScope,
    can: (permission) => granted.has(permission),
  };
}
