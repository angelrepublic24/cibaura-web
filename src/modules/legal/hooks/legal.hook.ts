import { useQuery } from "@tanstack/react-query";
import { legalService } from "@/modules/legal/services/legal.service";
import type { ContractKind } from "@/shared/types/domain";

/** Query keys for the legal module (the only cache it owns). */
export const legalKeys = {
  all: ["legal"] as const,
  current: () => ["legal", "current"] as const,
  contract: (kind: string) => ["legal", "contract", kind] as const,
};

/**
 * Current terms version + hosted legal URLs. Effectively immutable for the
 * lifetime of a page load (bumping the version is a backend deploy), so it
 * never goes stale and is shared by every form that renders the terms
 * checkbox.
 */
export function useLegalCurrent() {
  return useQuery({
    queryKey: legalKeys.current(),
    queryFn: () => legalService.current(),
    staleTime: Infinity,
  });
}

/**
 * The PUBLISHED contract template of a kind (`GET /legal/contracts/:kind`),
 * with generic placeholders — what a customer reads on the car page before
 * any booking exists. A new version is an admin publish (rare), so a few
 * minutes of staleness is fine.
 */
export function usePublicContract(kind: ContractKind, enabled = true) {
  return useQuery({
    queryKey: legalKeys.contract(kind),
    queryFn: () => legalService.contract(kind),
    staleTime: 5 * 60_000,
    enabled,
  });
}
