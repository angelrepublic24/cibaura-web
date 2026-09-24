import "server-only";
import { QueryClient } from "@tanstack/react-query";
import { publicGet } from "./public-api";
import { agencyProfileKeys } from "@/features/agencies/api";
import type {
  AgencyCarsFilters,
  AgencyDirectoryFilters,
  AgencyPublicProfile,
  Review,
} from "@/features/agencies/api";
import type { CarSearchFilters } from "@/features/cars/filters";
import {
  agencyCarsParams,
  carSearchParams,
} from "@/features/cars/request-params";
import type { Car, City, Paginated } from "@/shared/types/domain";

export function publicQueryClient() {
  // One instance per request; never share sessions or dehydrated data globally.
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
}

function queryString(params: Record<string, string | number | undefined>) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") result.set(key, String(value));
  }
  return result.toString();
}

async function requiredGet<T>(path: string, revalidate = 300): Promise<T> {
  const result = await publicGet<T>(path, revalidate);
  if (result === null) throw new Error(`Public endpoint unavailable: ${path}`);
  return result;
}

export function getDirectory(filters: AgencyDirectoryFilters) {
  return requiredGet<Paginated<AgencyPublicProfile>>(
    `/agencies?${queryString({ ...filters })}`,
  );
}

export function getAgencyCars(slug: string, filters: AgencyCarsFilters) {
  return requiredGet<Paginated<Car>>(
    `/agencies/${encodeURIComponent(slug)}/cars?${queryString(agencyCarsParams(filters))}`,
  );
}

export function getCarSearch(city: string, filters: CarSearchFilters) {
  // Date-specific availability must not inherit the five-minute catalog cache.
  return requiredGet<Paginated<Car>>(
    `/cars/search?${queryString(carSearchParams(city, filters))}`,
    0,
  );
}

export async function getAgencyReviews(slug: string) {
  // Reviews are optional content. An unavailable reviews endpoint must not hide a car.
  try {
    return await requiredGet<Paginated<Review>>(
      `/agencies/${encodeURIComponent(slug)}/reviews?page=1`,
    );
  } catch (error) {
    console.warn("Public reviews could not be prefetched", error);
    return null;
  }
}

export async function prefetchCities(client: QueryClient) {
  // Optional controls: their failure must not discard a successfully loaded listing.
  await client.prefetchQuery({
    queryKey: agencyProfileKeys.availableCities(),
    queryFn: () => requiredGet<City[]>("/agencies/available-cities"),
  });
}
