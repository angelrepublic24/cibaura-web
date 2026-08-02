import { Api } from "@/shared/api/client";
import type { CatalogMake, CatalogModel, City } from "@/shared/types/domain";

/**
 * Catalog & geo API module (public, seeded data).
 *
 * Expected backend endpoints (integrator: align with backend routes):
 *  - GET /geo/cities                      -> City[]          (v1: DR cities)
 *  - GET /catalog/makes                   -> CatalogMake[]
 *  - GET /catalog/makes/:makeId/models    -> CatalogModel[]  (dependent dropdown)
 *
 * Agencies SELECT make/model from this catalog (never free text) so
 * search facets stay clean — see docs/DOMAIN.md.
 */

export const catalogKeys = {
  all: ["catalog"] as const,
  cities: () => ["catalog", "cities"] as const,
  makes: () => ["catalog", "makes"] as const,
  models: (makeId: string) => ["catalog", "models", makeId] as const,
};

export const CatalogApi = {
  async listCities(): Promise<City[]> {
    const res = await Api.get("/geo/cities");
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
