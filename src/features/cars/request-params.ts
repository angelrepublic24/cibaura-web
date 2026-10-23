import type { CarSearchFilters } from "./filters";
import type { AgencyCarsFilters } from "@/features/agencies/api";
import { wholeUnitsToCents } from "@/shared/utils/money";

// Shared by browser Axios and server fetch: hydration must use identical filters.
//
// `priceMinCents`/`priceMaxCents` are RENTER-facing cents: the backend marks
// each car's host rate up before comparing, so a bound typed against the
// price on the card matches the cars the card shows.
function facets(filters: CarSearchFilters) {
  return {
    make: filters.make,
    model: filters.model,
    yearMin: filters.yearMin,
    yearMax: filters.yearMax,
    color: filters.color,
    category: filters.category,
    transmission: filters.transmission,
    priceMinCents:
      filters.priceMin === undefined
        ? undefined
        : wholeUnitsToCents(filters.priceMin),
    priceMaxCents:
      filters.priceMax === undefined
        ? undefined
        : wholeUnitsToCents(filters.priceMax),
    page: filters.page,
  };
}

/**
 * `ratingMin` and `sort` are NOT in `facets()` on purpose.
 *
 * `facets()` is shared with the agency storefront, whose DTO knows neither
 * parameter — and the API validates with `forbidNonWhitelisted`, so sending
 * one there would 400 the whole storefront rather than be ignored. They are
 * listed here and in `carCatalogParams`, the two surfaces that accept them.
 */
function publicBrowsing(filters: CarSearchFilters) {
  return {
    ratingMin: filters.ratingMin,
    sort: filters.sort,
  };
}

export function carSearchParams(city: string, filters: CarSearchFilters) {
  return {
    ...facets(filters),
    ...publicBrowsing(filters),
    country: filters.country,
    region: filters.region,
    city: city && city !== "all" ? city : undefined,
    start: filters.from,
    end: filters.to,
  };
}

export function agencyCarsParams(filters: AgencyCarsFilters) {
  return {
    ...facets(filters),
    branchId: filters.branchId,
    sort: filters.sort,
    pageSize: filters.pageSize,
  };
}

/** Published inventory only, with no availability/date parameters. */
export function carCatalogParams(city: string, filters: CarSearchFilters) {
  return {
    ...facets(filters),
    ...publicBrowsing(filters),
    country: filters.country,
    region: filters.region,
    city: city && city !== "all" ? city : undefined,
  };
}
