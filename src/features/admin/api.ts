import { Api } from "@/shared/api/client";
import type {
  CatalogMake,
  CatalogModel,
  City,
  Country,
  PlatformConfig,
} from "@/shared/types/domain";

/**
 * Platform admin API module (platform_admin only).
 *
 * Real backend routes (verified against the controllers):
 *  - GET   /admin/config                    -> { commissionPct }
 *  - PATCH /admin/config/commission { commissionPct } -> { commissionPct }
 *      (commission is SNAPSHOTTED into each booking at request time —
 *       changing it never rewrites existing bookings)
 *  - POST  /catalog/makes { name }                 -> CatalogMake  (admin)
 *  - POST  /catalog/makes/:makeId/models { name }  -> CatalogModel (admin)
 *
 * Read views reuse the PUBLIC catalog/geo endpoints (same data the search
 * facets use): GET /catalog/makes, /catalog/makes/:id/models, /geo/countries,
 * /geo/cities. There is no agency-oversight endpoint yet — omitted on purpose
 * rather than pointing at a route that 404s.
 */

export const adminKeys = {
  all: ["admin"] as const,
  config: () => ["admin", "config"] as const,
  makes: () => ["admin", "catalog", "makes"] as const,
  models: (makeId: string) => ["admin", "catalog", "models", makeId] as const,
  countries: () => ["admin", "geo", "countries"] as const,
  cities: () => ["admin", "geo", "cities"] as const,
};

export const AdminApi = {
  async getConfig(): Promise<PlatformConfig> {
    const res = await Api.get("/admin/config");
    return res.data;
  },

  async setCommission(commissionPct: number): Promise<PlatformConfig> {
    const res = await Api.patch("/admin/config/commission", { commissionPct });
    return res.data;
  },

  // ── Catalog (read = public endpoints; write = admin-gated POSTs) ──────────

  async listMakes(): Promise<CatalogMake[]> {
    const res = await Api.get("/catalog/makes");
    return res.data;
  },

  async listModels(makeId: string): Promise<CatalogModel[]> {
    const res = await Api.get(`/catalog/makes/${makeId}/models`);
    return res.data;
  },

  async createMake(name: string): Promise<CatalogMake> {
    const res = await Api.post("/catalog/makes", { name });
    return res.data;
  },

  async createModel(makeId: string, name: string): Promise<CatalogModel> {
    const res = await Api.post(`/catalog/makes/${makeId}/models`, { name });
    return res.data;
  },

  // ── Geo (read = public; city creation = admin-gated) ─────────────────────

  async listCountries(): Promise<Country[]> {
    const res = await Api.get("/geo/countries");
    return res.data;
  },

  async listCities(): Promise<City[]> {
    const res = await Api.get("/geo/cities");
    return res.data;
  },

  async createCity(input: {
    countryId: string;
    name: string;
    slug?: string;
  }): Promise<City> {
    const res = await Api.post("/geo/cities", input);
    return res.data;
  },
};
