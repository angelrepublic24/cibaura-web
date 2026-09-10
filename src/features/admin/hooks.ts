"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AdminApi,
  adminKeys,
  type AdminClaimsQuery,
  type AdminPayoutAccountsQuery,
} from "@/features/admin/api";
import type { ContractKind } from "@/shared/types/domain";

/**
 * Query hooks for the v1-expansion admin surfaces (contracts, platform
 * config, claims, car documents, payout accounts). Keys come from
 * `adminKeys` so mutations invalidate the same subtrees the pages read.
 */

export function usePlatformConfig() {
  return useQuery({
    queryKey: adminKeys.config(),
    queryFn: AdminApi.getConfig,
  });
}

export function useContractTemplates(kind: ContractKind) {
  return useQuery({
    queryKey: adminKeys.contractTemplates(kind),
    queryFn: () => AdminApi.listContractTemplates(kind),
  });
}

/** Server preview of a SAVED template; `enabled` gates it until one is selected. */
export function useContractPreview(id: string | null) {
  return useQuery({
    queryKey: adminKeys.contractPreview(id ?? ""),
    queryFn: () => AdminApi.previewContractTemplate(id ?? ""),
    enabled: !!id,
  });
}

export function useAdminClaims(query: AdminClaimsQuery) {
  return useQuery({
    queryKey: adminKeys.claims(query),
    queryFn: () => AdminApi.listClaims(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminClaim(id: string) {
  return useQuery({
    queryKey: adminKeys.claim(id),
    queryFn: () => AdminApi.getClaim(id),
    enabled: !!id,
  });
}

/** Inspections with signed media URLs; the links expire, so never cache long. */
export function useBookingInspections(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.bookingInspections(bookingId),
    queryFn: () => AdminApi.listBookingInspections(bookingId),
    enabled: enabled && !!bookingId,
    staleTime: 60_000,
  });
}

export function useAgencyCars(agencyId: string) {
  return useQuery({
    queryKey: adminKeys.agencyCars(agencyId),
    queryFn: () => AdminApi.listAgencyCars(agencyId),
  });
}

export function useCarDocuments(carId: string) {
  return useQuery({
    queryKey: adminKeys.carDocuments(carId),
    queryFn: () => AdminApi.listCarDocuments(carId),
  });
}

export function useAdminPayoutAccounts(query: AdminPayoutAccountsQuery) {
  return useQuery({
    queryKey: adminKeys.payoutAccounts(query),
    queryFn: () => AdminApi.listPayoutAccounts(query),
    placeholderData: keepPreviousData,
  });
}
