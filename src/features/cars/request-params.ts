import type { CarSearchFilters } from "./filters";
import type { AgencyCarsFilters } from "@/features/agencies/api";
import { wholeUnitsToCents } from "@/shared/utils/money";

// Shared by browser Axios and server fetch: hydration must use identical filters.
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

export function carSearchParams(city: string, filters: CarSearchFilters) {
  return {
    ...facets(filters),
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
