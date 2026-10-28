import { Api } from "@/shared/api/client";
import type {
  CatalogMake,
  CatalogModel,
  City,
  Country,
  Region,
} from "@/shared/types/domain";
import {
  catalogMakeListWireSchema,
  catalogModelListWireSchema,
  cityListWireSchema,
  countryListWireSchema,
  regionListWireSchema,
} from "@/modules/catalog/schema/catalog.schema";

/**
 * Catalog & geo API client — the ONLY thing in the module that talks to the
 * backend. Every method is a single call that validates the response against
 * its zod schema and returns a typed result; hooks call these, components
 * call hooks.
 *
 * Public, seeded reference data (no session required):
 *  - GET /geo/countries                 -> Country[]   (the markets)
 *  - GET /geo/regions?country=do        -> Region[]    (provinces / states)
 *  - GET /geo/cities[?country=do]       -> City[]
 *  - GET /catalog/makes                 -> CatalogMake[]
 *  - GET /catalog/makes/:makeId/models  -> CatalogModel[]
 *
 * Agencies SELECT make/model from this catalog (never free text) so search
 * facets stay clean — see docs/DOMAIN.md.
 */
class CatalogService {
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
    const res = await Api.get<unknown>("/geo/cities", {
      params: countryCode ? { country: countryCode.toLowerCase() } : undefined,
    });
    return cityListWireSchema.parse(res.data);
  }

  /** The markets the platform operates in — one row per country it serves. */
  async listCountries(): Promise<Country[]> {
    const res = await Api.get<unknown>("/geo/countries");
    return countryListWireSchema.parse(res.data);
  }

  /**
   * A country's first-level subdivisions: provinces in the DR, states in the
   * US. `countryCode` is the ISO alpha-2 the server expects lowercased.
   */
  async listRegions(countryCode: string): Promise<Region[]> {
    const res = await Api.get<unknown>("/geo/regions", {
      params: { country: countryCode.toLowerCase() },
    });
    return regionListWireSchema.parse(res.data);
  }

  async listMakes(): Promise<CatalogMake[]> {
    const res = await Api.get<unknown>("/catalog/makes");
    return catalogMakeListWireSchema.parse(res.data);
  }

  async listModels(makeId: string): Promise<CatalogModel[]> {
    const res = await Api.get<unknown>(
      `/catalog/makes/${encodeURIComponent(makeId)}/models`,
    );
    return catalogModelListWireSchema.parse(res.data);
  }
}

export const catalogService = new CatalogService();
