import { useQuery } from "@tanstack/react-query";
import { carsService } from "@/modules/cars/services/cars.service";
import type { CarSearchFilters } from "@/modules/cars/types/cars.types";

/** Query keys for the cars module (the only cache it owns). */
export const carKeys = {
  all: ["cars"] as const,
  search: (city: string, filters: CarSearchFilters) =>
    ["cars", "search", city, filters] as const,
  catalog: (city: string, filters: CarSearchFilters) =>
    ["cars", "catalog", city, filters] as const,
  detail: (carId: string) => ["cars", "detail", carId] as const,
  availability: (carId: string, from: string, to: string) =>
    ["cars", "availability", carId, from, to] as const,
};

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
 */
export function useCarListing(city: string, filters: CarSearchFilters) {
  const dated = hasSearchDates(filters);
  return useQuery({
    queryKey: dated
      ? carKeys.search(city, filters)
      : carKeys.catalog(city, filters),
    queryFn: () =>
      dated
        ? carsService.search(city, filters)
        : carsService.catalog(city, filters),
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
