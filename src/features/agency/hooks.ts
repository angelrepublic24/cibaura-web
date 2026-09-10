"use client";

import { useEffect } from "react";
import {
  useInfiniteQuery,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { AgencyApi, agencyKeys, type FleetFilters } from "./api";
import { bookingKeys } from "@/features/bookings/api";
import type { AgencyCar, Paginated } from "@/shared/types/domain";

/**
 * The caller's agency session (`GET /agency/session`): the agency (kind,
 * verification, host-agreement flags) + membership. Same key/staleTime as
 * `usePermission`, so the layout, nav and pages share ONE request.
 */
export function useAgencySession(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.session(),
    queryFn: AgencyApi.session,
    staleTime: 60_000,
    enabled,
  });
}

/** Page size for fleet pickers — large enough that one page covers most agencies. */
export const FLEET_PICKER_PAGE_SIZE = 100;

function nextFleetPage(last: Paginated<AgencyCar>): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined;
}

/**
 * The fleet as an infinite (page-by-page) list — the fleet screen renders
 * pages under a "Load more" button. `filters` never includes `page`; the
 * query owns paging.
 */
export function useFleetPages(filters: Omit<FleetFilters, "page"> = {}) {
  return useInfiniteQuery({
    queryKey: agencyKeys.fleetPages(filters),
    queryFn: ({ pageParam }) =>
      AgencyApi.fleet({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextFleetPage,
  });
}

/**
 * EVERY car matching `filters`, for pickers (calendar filter, manual-block
 * car, walk-in car) where a `<select>` cannot paginate: walks the pages
 * (`pageSize = 100`) until the server reports no more. Exposes the flat list
 * plus the loading/error flags of the walk.
 */
export function useAllFleet(filters: Omit<FleetFilters, "page" | "pageSize"> = {}) {
  const query = useInfiniteQuery({
    queryKey: agencyKeys.fleetPages({
      ...filters,
      pageSize: FLEET_PICKER_PAGE_SIZE,
    }),
    queryFn: ({ pageParam }) =>
      AgencyApi.fleet({
        ...filters,
        pageSize: FLEET_PICKER_PAGE_SIZE,
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: nextFleetPage,
  });

  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const cars: AgencyCar[] = query.data?.pages.flatMap((p) => p.items) ?? [];

  return {
    cars,
    /** True until the LAST page has landed (pickers stay disabled meanwhile). */
    isLoading: query.isLoading || (hasNextPage === true && !query.isError),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ── Booking operations (ADR-0011 / ADR-0013) ────────────────────────────────

/**
 * Check-in / check-out records of a booking with SIGNED media URLs (short
 * TTL — refetched after a minute so expired links are replaced before the
 * viewer needs them). `enabled` lets the panel skip the request until the
 * booking says a record exists.
 */
export function useAgencyInspections(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: agencyKeys.inspections(bookingId),
    queryFn: () => AgencyApi.inspections(bookingId),
    staleTime: 60_000,
    enabled: enabled && !!bookingId,
  });
}

/** Every damage claim filed on a booking (the current one + withdrawn history). */
export function useAgencyClaims(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: agencyKeys.claims(bookingId),
    queryFn: () => AgencyApi.claims(bookingId),
    enabled: enabled && !!bookingId,
  });
}

/**
 * After anything that moves a booking on the agency side (an inspection
 * finalizes, a claim is filed, the booking settles): the inbox, calendar
 * and wallet shift, the booking's own sub-resources are stale, and the
 * detail (`GET /bookings/:id`, keyed under `bookings`) must refetch too.
 */
export function invalidateAgencyBooking(qc: QueryClient, bookingId: string): void {
  void qc.invalidateQueries({ queryKey: agencyKeys.all });
  void qc.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
}
