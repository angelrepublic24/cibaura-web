"use client";

import { useQuery } from "@tanstack/react-query";
import { LegalApi, legalKeys } from "@/features/legal/api";

/**
 * Current terms version + hosted legal URLs. Effectively immutable for the
 * lifetime of a page load (bumping the version is a backend deploy), so it
 * never goes stale and is shared by every form that renders the terms
 * checkbox.
 */
export function useLegalCurrent() {
  return useQuery({
    queryKey: legalKeys.current(),
    queryFn: LegalApi.current,
    staleTime: Infinity,
  });
}

/**
 * The PUBLISHED contract template of a kind (`GET /legal/contracts/:kind`),
 * with generic placeholders — what a customer reads on the car page before
 * any booking exists. A new version is an admin publish (rare), so a few
 * minutes of staleness is fine.
 */
export function usePublicContract(kind: string, enabled = true) {
  return useQuery({
    queryKey: legalKeys.contract(kind),
    queryFn: () => LegalApi.contract(kind),
    staleTime: 5 * 60_000,
    enabled,
  });
}
