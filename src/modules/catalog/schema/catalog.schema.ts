import { z } from "zod";

/**
 * Catalog & geo wire schemas (zod v4). Everything here is PUBLIC, seeded
 * reference data: the markets the platform serves, their subdivisions and
 * cities, and the make/model catalog an agency picks a car from.
 *
 * `CatalogService` validates every response against these
 * (`schema.parse(res.data)`), so a backend that renames a field fails loudly
 * at the boundary instead of rendering an empty dropdown. The `z.infer` types
 * live in `../types/catalog.types`.
 */

/** `GET /geo/countries` — one row per market the platform operates in. */
export const countryWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** ISO-3166 alpha-2, e.g. "DO". */
  code: z.string(),
  /**
   * The country's own tax rate, or `null` when it has none of its own —
   * which means the PLATFORM rate applies, not that the market is tax-free.
   */
  taxRatePct: z.number().nullable(),
});

/** `GET /geo/regions?country=xx` — provinces in the DR, states in the US. */
export const regionWireSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  name: z.string(),
  slug: z.string(),
  code: z.string().nullable(),
  kind: z.string(),
});

/** `GET /geo/cities` — `slug` is what `/cars/[city]` routes on. */
export const cityWireSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  regionId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
});

/** `GET /catalog/makes`. */
export const catalogMakeWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

/** `GET /catalog/makes/:makeId/models`. */
export const catalogModelWireSchema = z.object({
  id: z.string(),
  makeId: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const countryListWireSchema = z.array(countryWireSchema);
export const regionListWireSchema = z.array(regionWireSchema);
export const cityListWireSchema = z.array(cityWireSchema);
export const catalogMakeListWireSchema = z.array(catalogMakeWireSchema);
export const catalogModelListWireSchema = z.array(catalogModelWireSchema);
