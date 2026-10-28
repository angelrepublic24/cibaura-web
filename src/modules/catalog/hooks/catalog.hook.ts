import { skipToken, useQuery } from "@tanstack/react-query";
import { catalogService } from "@/modules/catalog/services/catalog.service";

/** Query keys for the catalog module (the only cache this module owns). */
export const catalogKeys = {
  all: ["catalog"] as const,
  cities: (countryCode?: string) =>
    ["catalog", "cities", countryCode ?? "all"] as const,
  countries: () => ["catalog", "countries"] as const,
  regions: (countryCode: string) =>
    ["catalog", "regions", countryCode] as const,
  makes: () => ["catalog", "makes"] as const,
  models: (makeId: string) => ["catalog", "models", makeId] as const,
};

/** `GET /geo/countries` — the markets the platform operates in. */
export function useCountries() {
  return useQuery({
    queryKey: catalogKeys.countries(),
    queryFn: () => catalogService.listCountries(),
  });
}

/**
 * `GET /geo/regions?country=xx`. Subdivisions are only asked for when a form
 * actually needs one (a US state, never a Dominican province), so the caller
 * passes `enabled` and the query stays idle otherwise.
 */
export function useRegions(countryCode: string, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.regions(countryCode),
    queryFn:
      enabled && countryCode
        ? () => catalogService.listRegions(countryCode)
        : skipToken,
  });
}

/** `GET /geo/cities`, optionally narrowed to one country. */
export function useCities(countryCode?: string) {
  return useQuery({
    queryKey: catalogKeys.cities(countryCode),
    queryFn: () => catalogService.listCities(countryCode),
  });
}

/** `GET /catalog/makes` — the make side of the car catalog. */
export function useCarMakes() {
  return useQuery({
    queryKey: catalogKeys.makes(),
    queryFn: () => catalogService.listMakes(),
  });
}

/**
 * `GET /catalog/makes/:makeId/models` — the dependent half of the make/model
 * pair. Idle until a make is chosen.
 */
export function useCarModels(makeId: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.models(makeId ?? ""),
    queryFn: makeId ? () => catalogService.listModels(makeId) : skipToken,
  });
}
