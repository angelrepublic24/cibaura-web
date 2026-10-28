import type { z } from "zod";
import type {
  catalogMakeWireSchema,
  catalogModelWireSchema,
  cityWireSchema,
  countryWireSchema,
  regionWireSchema,
} from "@/modules/catalog/schema/catalog.schema";

/**
 * Catalog & geo types — every one is the `z.infer` of a schema in
 * `../schema`, so the schema is the single source of truth.
 *
 * These are structurally the shared `Country`/`Region`/`City`/`CatalogMake`/
 * `CatalogModel` in `@/shared/types/domain`, which is what the service
 * returns and what consumers across the app already speak. The compiler
 * enforces that equivalence at the service's return annotations: if a schema
 * and its shared interface ever drift, `catalog.service.ts` stops building.
 */
export type CountryWire = z.infer<typeof countryWireSchema>;
export type RegionWire = z.infer<typeof regionWireSchema>;
export type CityWire = z.infer<typeof cityWireSchema>;
export type CatalogMakeWire = z.infer<typeof catalogMakeWireSchema>;
export type CatalogModelWire = z.infer<typeof catalogModelWireSchema>;
