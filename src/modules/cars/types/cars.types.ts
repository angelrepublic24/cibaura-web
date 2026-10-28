import type { z } from "zod";
import type {
  availabilityWireSchema,
  carDetailWireSchema,
  carPageWireSchema,
  carSearchFiltersSchema,
  carSortSchema,
} from "@/modules/cars/schema/cars.schema";

/** Browsing order, the backend's `PublicCarSort` verbatim. */
export type CarSort = z.infer<typeof carSortSchema>;

/**
 * The normalized search filters — read from the URL, used as the query key
 * and as the API params. Every field is optional because every field
 * degrades to "no filter" (see `carSearchFiltersSchema`).
 */
export type CarSearchFilters = z.infer<typeof carSearchFiltersSchema>;

export type CarPageWire = z.infer<typeof carPageWireSchema>;
export type CarDetailWire = z.infer<typeof carDetailWireSchema>;
export type AvailabilityWire = z.infer<typeof availabilityWireSchema>;
