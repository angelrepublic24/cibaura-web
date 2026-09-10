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
