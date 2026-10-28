import { z } from "zod";
import {
  CAR_CATEGORIES,
  CAR_COLORS,
  FUEL_TYPES,
  TRANSMISSIONS,
} from "@/shared/types/domain";

/**
 * Wire schemas for the entities that cross MODULE boundaries.
 *
 * `src/shared/types/domain.ts` already holds the shared TYPES; this is its
 * runtime half. A `Car` is returned by the agencies storefront, the car
 * search, the agency fleet and the booking surfaces, so pinning its schema in
 * one of those modules would make the other three import a sibling's
 * internals. Anything owned by a single module stays in that module's
 * `schema/` folder.
 */

/**
 * The paginated envelope every list endpoint uses. Generic so each caller
 * keeps its item type: `paginatedWireSchema(reviewWireSchema)`.
 */
export function paginatedWireSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  });
}

export const namedRefWireSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const carAgencyRefWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  kind: z.enum(["business", "individual"]),
  /**
   * The host's stars, so a card can show the rating the results are sorted
   * by. READ BOTH: `ratingAvg` is 0 for a host with no reviews, which means
   * "no reviews yet" and not "zero stars" — `reviewCount` tells them apart.
   */
  ratingAvg: z.number(),
  reviewCount: z.number(),
});

export const carStatusSchema = z.enum(["draft", "active", "paused"]);

/** A car as every public and private listing returns it. */
export const carWireSchema = z.object({
  location: z.object({
    city: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
    region: z
      .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        kind: z.string(),
      })
      .nullable(),
    countryCode: z.string(),
  }),
  id: z.string(),
  branchId: z.string(),
  agency: carAgencyRefWireSchema,
  make: namedRefWireSchema,
  model: namedRefWireSchema,
  year: z.number(),
  color: z.enum(CAR_COLORS),
  transmission: z.enum(TRANSMISSIONS),
  fuel: z.enum(FUEL_TYPES),
  seats: z.number(),
  category: z.enum(CAR_CATEGORIES),
  /** The host's own per-day rate, integer cents. HOST/ADMIN screens only. */
  hostDailyRateCents: z.number(),
  /** The per-day rate a renter is shown, integer cents (commission included). */
  renterDailyRateCents: z.number(),
  primaryPhoto: z.string().nullable(),
  /**
   * ORDERED gallery URLs. Uploaded photos arrive as API paths
   * (`/cars/photos/:photoId`); legacy absolute URLs pass through.
   */
  photos: z.array(z.string()),
  status: carStatusSchema,
});
