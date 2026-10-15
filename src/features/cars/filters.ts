/**
 * Car search filters — the URL is the source of truth (shareable + SEO):
 * `/cars/santiago?from=2026-08-01&to=2026-08-05&make=toyota&year_min=2022`.
 *
 * `parseCarFilters` normalizes raw Next.js `searchParams` into a stable,
 * serializable object that is used BOTH as the TanStack Query key part
 * and as the API request params — so a URL change is a new cache entry.
 *
 * THIS IS THE LEAST TRUSTED INPUT IN THE WEB APP: anything a crawler, a
 * stale link or a hand-edited address bar can carry arrives here, and from
 * here it reaches a cache key and an API query string. Every field is parsed
 * by a zod schema below, and every one of those schemas ends in `.catch()`,
 * because the rule on this path is DEGRADE, NEVER THROW — `?page=abc` has
 * always meant "no page", and turning it into a 500 would break URLs that
 * work today.
 */
import { z } from "zod";
import { isIsoDate } from "@/shared/utils/dates";

export interface CarSearchFilters {
  country?: string;
  region?: string;
  /** Date range (ISO dates, half-open [from, to)). */
  from?: string;
  to?: string;
  /** Catalog slugs (stable across renames). */
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  color?: string;
  category?: string;
  transmission?: string;
  /** Per-day price bounds in WHOLE currency units (URL-friendly). */
  priceMin?: number;
  priceMax?: number;
  page?: number;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

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
  .preprocess(
    firstValue,
    z.string().trim().refine(isIsoDate).optional(),
  )
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

export function parseCarFilters(sp: RawSearchParams): CarSearchFilters {
  return {
    // Country codes are compared upper-case everywhere downstream, including
    // by the public `countryCodeSchema` gate on /cars/[city]. Region is not.
    country: urlText.parse(sp.country)?.toUpperCase(),
    region: urlText.parse(sp.region),
    from: urlIsoDate.parse(sp.from),
    to: urlIsoDate.parse(sp.to),
    make: urlText.parse(sp.make),
    model: urlText.parse(sp.model),
    yearMin: urlNumber.parse(sp.year_min),
    yearMax: urlNumber.parse(sp.year_max),
    color: urlText.parse(sp.color),
    category: urlText.parse(sp.category),
    transmission: urlText.parse(sp.transmission),
    priceMin: urlNumber.parse(sp.price_min),
    priceMax: urlNumber.parse(sp.price_max),
    page: urlNumber.parse(sp.page),
  };
}

/**
 * Serialize filters back into URL search params (skips empty values).
 *
 * NOT the inverse of the parser and deliberately unvalidated: callers hand it
 * partial, hand-built objects (`{ from, to }` from the hero search, `{}` from
 * "clear all"), and the ORDER of the `set` calls below is asserted verbatim by
 * `scripts/destination-smoke.mjs` and by every canonical URL in
 * `scripts/seo-smoke.mjs`. Derive it from a schema and both go red.
 */
export function filtersToSearchParams(f: CarSearchFilters): URLSearchParams {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  };
  set("country", f.country);
  set("region", f.region);
  set("from", f.from);
  set("to", f.to);
  set("make", f.make);
  set("model", f.model);
  set("year_min", f.yearMin);
  set("year_max", f.yearMax);
  set("color", f.color);
  set("category", f.category);
  set("transmission", f.transmission);
  set("price_min", f.priceMin);
  set("price_max", f.priceMax);
  set("page", f.page);
  return sp;
}
