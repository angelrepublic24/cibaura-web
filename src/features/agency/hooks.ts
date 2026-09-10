"use client";

import { useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys, type FleetFilters } from "./api";
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
