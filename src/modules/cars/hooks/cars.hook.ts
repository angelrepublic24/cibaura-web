import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { carsService } from "@/modules/cars/services/cars.service";
import { carSearchRangeProblem } from "@/modules/cars/helpers/cars.helper";
import type { CarSearchFilters } from "@/modules/cars/types/cars.types";
import { useAuthStore } from "@/shared/auth/store";

/**
 * WHOSE copy of a listing a cache entry holds.
 *
 * `GET /cars/search` and `/cars/catalog` are VIEWER-AWARE: with a session the
 * backend drops the cars of agencies this user blocked from `items` AND from
 * `facets`; without one it serves everyone the same unfiltered answer. So the
 * two responses are DIFFERENT DOCUMENTS and must never share a cache entry —
 * sharing one would either show a user the agency they blocked or show an
 * anonymous visitor somebody else's filtered list.
 *
 * `ANONYMOUS_VIEWER` is what the server prefetch seeds (it forwards no
 * cookies, by design — see `shared/seo/public-api.ts`), which is also what
 * crawlers and logged-out visitors read. A signed-in viewer uses their own id
 * and therefore fetches their own copy on the client. That costs a signed-in
 * user one request the SSR payload cannot answer for them; it is the price of
 * a per-user response, and the alternative is a lie.
 */
export const ANONYMOUS_VIEWER = "anon";
export type CarListingViewer = string;

/** Query keys for the cars module (the only cache it owns). */
export const carKeys = {
  all: ["cars"] as const,
  /** `viewer` is REQUIRED — never defaulted, so no caller can forget it. */
  search: (city: string, filters: CarSearchFilters, viewer: CarListingViewer) =>
    ["cars", "search", city, filters, viewer] as const,
  catalog: (
    city: string,
    filters: CarSearchFilters,
    viewer: CarListingViewer,
  ) => ["cars", "catalog", city, filters, viewer] as const,
  // Not viewer-aware: the backend serves `GET /cars/:id` to everybody
  // identically (a destination asked for by id is not the recommendation
  // flow), so one cached copy is correct for all viewers.
  detail: (carId: string) => ["cars", "detail", carId] as const,
  availability: (carId: string, from: string, to: string) =>
    ["cars", "availability", carId, from, to] as const,
};

/**
 * Which copy of a listing THIS render should read.
 *
 * `unknown` (the store before `useMe` has answered) deliberately maps to
 * anonymous: that is what the server rendered and seeded, so matching it
 * keeps the first paint free of a request. The moment the session resolves
 * the key changes to the user's own and their filtered copy is fetched.
 */
function useCarListingViewer(): CarListingViewer {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  return status === "authenticated" && userId ? userId : ANONYMOUS_VIEWER;
}

/**
 * Whether a filter set asks for a DATED search. Availability is a server-side
 * anti-join against CarOccupancy, so `GET /cars/search` requires both dates;
 * without them the only honest answer is the published catalog, which claims
 * nothing about availability.
 */
export function hasSearchDates(filters: CarSearchFilters): boolean {
  return !!filters.from && !!filters.to && filters.to > filters.from;
}

/**
 * The listing behind /cars/[city]: the dated availability search when the
 * renter has picked a range, the published catalog otherwise. The key tracks
 * which one answered, so the two never share a cache entry — and both are
 * the keys the server prefetch seeds.
 *
 * AN UNUSABLE RANGE FETCHES NOTHING (BUG-010). A past or backwards range
 * cannot be searched, and falling back to the undated catalogue would answer
 * a question nobody asked — cars the renter cannot book for the days they
 * typed. The query stays idle and the caller renders the reason instead.
 *
 * `keepPreviousData` IS WHAT MAKES THE VIEWER-AWARE KEY SURVIVABLE. Every key
 * input here changes under the user's feet: filters and paging by their own
 * hand, and `viewer` once per page load — `useMe` runs in the site header, so
 * a signed-in visitor's key flips from anonymous to their own id a beat after
 * the first paint. Without a placeholder the new key is cold, `isLoading`
 * turns true and the grid that was already on screen collapses into
 * skeletons: a shortening document and a layout jump on the busiest page of
 * the site, for every signed-in user, on every visit.
 *
 * Holding the previous answer reveals nothing: it is the copy this very page
 * already painted (the server prefetch seeds the anonymous key, so the first
 * paint IS the unfiltered list). The caller dims it via `isPlaceholderData`
 * so it reads as "refreshing" rather than as the final answer, exactly as the
 * admin queue does.
 */
export function useCarListing(city: string, filters: CarSearchFilters) {
  const dated = hasSearchDates(filters);
  const usable = carSearchRangeProblem(filters) === null;
  const viewer = useCarListingViewer();
  return useQuery({
    queryKey: dated
      ? carKeys.search(city, filters, viewer)
      : carKeys.catalog(city, filters, viewer),
    queryFn: () =>
      dated
        ? carsService.search(city, filters)
        : carsService.catalog(city, filters),
    enabled: usable,
    placeholderData: keepPreviousData,
  });
}

/** `GET /cars/:carId` — the public car page. */
export function useCarDetail(carId: string) {
  return useQuery({
    queryKey: carKeys.detail(carId),
    queryFn: () => carsService.findById(carId),
  });
}

/**
 * `GET /cars/:carId/availability` — the occupied windows the date picker
 * blocks out. Idle until the caller has a range to ask about.
 */
export function useCarAvailability(
  carId: string,
  from: string,
  to: string,
  enabled = true,
) {
  return useQuery({
    queryKey: carKeys.availability(carId, from, to),
    queryFn: () => carsService.availability(carId, from, to),
    enabled,
  });
}
