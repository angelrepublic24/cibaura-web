import { Api } from "@/shared/api/client";
import type {
  CatalogMake,
  CatalogModel,
  City,
  Country,
  Region,
} from "@/shared/types/domain";

/**
 * Catalog & geo API module (public, seeded data).
 *
 * Expected backend endpoints (integrator: align with backend routes):
 *  - GET /geo/countries                   -> Country[]       (the markets)
 *  - GET /geo/regions?country=do          -> Region[]        (provinces/states)
 *  - GET /geo/cities                      -> City[]          (v1: DR cities)
 *  - GET /catalog/makes                   -> CatalogMake[]
 *  - GET /catalog/makes/:makeId/models    -> CatalogModel[]  (dependent dropdown)
 *
 * Agencies SELECT make/model from this catalog (never free text) so
 * search facets stay clean — see docs/DOMAIN.md.
 */

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

export const CatalogApi = {
  /**
   * Every city the platform serves, or only those of one country.
   *
   * The country filter exists for the host application: a national id card
   * must be issued by the country the host lives in, so once they say "my
   * cédula is Dominican" the address step may only offer Dominican cities.
   * Narrowing the list is what makes that rule unbreakable rather than a
   * validation error two steps later.
   */
  async listCities(countryCode?: string): Promise<City[]> {
    const res = await Api.get("/geo/cities", {
      params: countryCode ? { country: countryCode.toLowerCase() } : undefined,
    });
    return res.data;
  },

  /** The markets the platform operates in — one row per country it serves. */
  async listCountries(): Promise<Country[]> {
    const res = await Api.get("/geo/countries");
    return res.data;
  },

  /**
   * A country's first-level subdivisions: provinces in the DR, states in the
   * US. `countryCode` is the ISO alpha-2 the server expects lowercased.
   */
  async listRegions(countryCode: string): Promise<Region[]> {
    const res = await Api.get("/geo/regions", {
      params: { country: countryCode.toLowerCase() },
    });
    return res.data;
  },

  async listMakes(): Promise<CatalogMake[]> {
    const res = await Api.get("/catalog/makes");
    return res.data;
  },

  async listModels(makeId: string): Promise<CatalogModel[]> {
    const res = await Api.get(`/catalog/makes/${makeId}/models`);
    return res.data;
  },
};
