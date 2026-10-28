import { z } from "zod";
import { isIsoDate } from "@/shared/utils/dates";
import {
  carAgencyRefWireSchema,
  carWireSchema,
  paginatedWireSchema,
} from "@/shared/api/wire";

/**
 * Car wire schemas + the URL-filter grammar of the public search (zod v4).
 *
 * `CarsService` validates every response against the wire schemas below;
 * `parseCarFilters` (helpers) parses the address bar through the filter
 * schemas. Money is NEVER derived on the client: every `*Cents` here is
 * rendered verbatim, and the price preview comes from the bookings surface
 * (`POST /bookings/quote`), never from a rate times a day count.
 */

// ── Wire ────────────────────────────────────────────────────────────────────

/**
 * Agency ref on a car DETAIL (`CarDetailAgencyDto`): the public slug ref plus
 * the terms the customer accepts at request time.
 */
export const carDetailAgencyWireSchema = carAgencyRefWireSchema.extend({
  rentalConditions: z.string().nullable(),
  minDriverAge: z.number(),
  depositNote: z.string().nullable(),
});

/**
 * The car's branch as the RENTER may see it: the exact street address and
 * the coordinates are private, so only the name, the city and the delivery
 * parameters cross the wire.
 */
export const carDetailBranchWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.object({ id: z.string(), name: z.string() }),
  deliveryEnabled: z.boolean(),
  renterDeliveryBaseFeeCents: z.number(),
  renterDeliveryPerKmCents: z.number(),
  deliveryMaxKm: z.number().nullable(),
});

/** An ACTIVE delivery zone of the branch, with the renter-facing fee. */
export const carDeliveryZoneWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  renterFeeCents: z.number(),
});

/** `GET /cars/:carId` — the public car page (no plate, ever). */
export const carDetailWireSchema = carWireSchema.extend({
  agency: carDetailAgencyWireSchema,
  branch: carDetailBranchWireSchema,
  deliveryZones: z.array(carDeliveryZoneWireSchema),
  /** Security deposit held at check-in (car -> agency -> platform), cents. */
  depositCents: z.number(),
  /** `depositCents > 0`, decided server-side. A hold is never part of a total. */
  depositRequired: z.boolean(),
});

export const carPageWireSchema = paginatedWireSchema(carWireSchema);

/** A blocked window, half-open `[start, end)`. */
export const periodWireSchema = z.object({
  start: z.string(),
  end: z.string(),
});

/**
 * `GET /cars/:carId/availability` — the windows the car is NOT free. The
 * server decides availability; the calendar only paints what it says.
 */
export const availabilityWireSchema = z.object({
  carId: z.string(),
  occupied: z.array(periodWireSchema),
});

// ── Browsing order ──────────────────────────────────────────────────────────

/**
 * The backend's `PublicCarSort` verbatim. These values travel in the URL
 * (`?sort=rating_desc`) and straight on to the API, so changing one is a
 * contract change — the on-screen labels live in the helper.
 */
export const CAR_SORT_VALUES = [
  "price_asc",
  "price_desc",
  "rating_desc",
  "year_desc",
] as const;

export const carSortSchema = z.enum(CAR_SORT_VALUES);

// ── URL filters ─────────────────────────────────────────────────────────────

/**
 * THIS IS THE LEAST TRUSTED INPUT IN THE WEB APP: anything a crawler, a
 * stale link or a hand-edited address bar can carry arrives here, and from
 * here it reaches a cache key and an API query string. Every field below
 * ends in `.catch()`, because the rule on this path is DEGRADE, NEVER
 * THROW — `?page=abc` has always meant "no page", and turning it into a 500
 * would break URLs that work today.
 */

/**
 * A repeated parameter (`?make=toyota&make=honda`) reaches Next as an array.
 * The FIRST entry wins — including when it is blank, which then falls through
 * to `undefined` like any other blank. Total by construction: it must never
 * throw, because a `preprocess` that throws escapes `.catch()`.
 */
const firstValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

/**
 * A trimmed, non-empty string. Absent, blank, whitespace-only and anything
 * the inner schema rejects all become `undefined`.
 *
 * `.catch()` sits on the OUTSIDE and `.optional()` on the inside: with the
 * optional on the outer wrapper, zod reports the `undefined` input as a type
 * error that `.catch()` does not intercept, and an absent parameter throws.
 */
export const urlText = z
  .preprocess(firstValue, z.string().trim().min(1).optional())
  .catch(undefined);

/**
 * A finite number, by the same grammar `Number()` accepts — hex (`0x10`),
 * binary, octal, exponents, a leading sign, a bare fraction (`.5`), and
 * negatives. Deliberately NOT narrowed to integers or to non-negatives: today
 * `?page=0`, `?year_min=-3` and `?year_max=2024.9` are all legal URLs, and
 * tightening the grammar here would silently drop filters that work.
 *
 * `Infinity` and `NaN` are rejected by `z.number()`, which is what keeps
 * `?page=1e309` from reaching the wire as `page=Infinity` — and keeps it from
 * colliding with `null` in the query-key hash.
 */
export const urlNumber = z
  .preprocess(
    firstValue,
    z.string().trim().min(1).transform(Number).pipe(z.number()).optional(),
  )
  .catch(undefined);

/**
 * A `YYYY-MM-DD` SHAPE, via the shared `isIsoDate` so there is one definition
 * of it. Shape only: `2026-13-45` is kept and forwarded, exactly as before —
 * the backend owns the calendar, and the UI compares these lexicographically.
 */
export const urlIsoDate = z
  .preprocess(firstValue, z.string().trim().refine(isIsoDate).optional())
  .catch(undefined);

/**
 * One of a fixed set, matched exactly after trimming. Case-sensitive on
 * purpose: `?sort=PRICE_ASC` has never been a valid sort.
 */
export function urlEnum<T extends string>(values: readonly [T, ...T[]]) {
  return z
    .preprocess(firstValue, z.string().trim().pipe(z.enum(values)).optional())
    .catch(undefined);
}

/**
 * Car search filters — the URL is the source of truth (shareable + SEO):
 * `/cars/santiago?from=2026-08-01&to=2026-08-05&make=toyota&year_min=2022`.
 *
 * The parsed object is used BOTH as the TanStack Query key part and as the
 * API request params, so a URL change is a new cache entry. Every field is
 * total: a value this schema cannot read degrades to `undefined` (= "no
 * filter") instead of failing the page.
 */
export const carSearchFiltersSchema = z.object({
  // Country codes are compared upper-case everywhere downstream, including
  // by the public `countryCodeSchema` gate on /cars/[city]. Region is not.
  country: urlText.transform((value) => value?.toUpperCase()).optional(),
  region: urlText,
  /** Date range (ISO dates, half-open [from, to)). */
  from: urlIsoDate,
  to: urlIsoDate,
  /** Catalog slugs (stable across renames). */
  make: urlText,
  model: urlText,
  yearMin: urlNumber,
  yearMax: urlNumber,
  color: urlText,
  category: urlText,
  transmission: urlText,
  /**
   * Per-day price bounds in WHOLE currency units (URL-friendly), in the
   * STOREFRONT's money — the rate shown on the cards, commission included.
   * The server compares them against the same figure.
   */
  priceMin: urlNumber,
  priceMax: urlNumber,
  /**
   * Minimum host rating, 0..5. A host with NO reviews is excluded when this
   * is set — "at least 4 stars" is not satisfied by "no stars" — which is
   * also why `undefined` and not `0` means "any": the server reads `0` as no
   * filter, but sending it would put a meaningless `rating_min=0` in every
   * shared link.
   */
  ratingMin: urlNumber,
  /**
   * Browsing order; `undefined` is the server's default (cheapest first).
   * An unrecognized order degrades rather than reaching the API and 400ing a
   * page a stale link or a crawler asked for — `?sort=best` has never been a
   * valid order.
   */
  sort: urlEnum(CAR_SORT_VALUES),
  page: urlNumber,
});
