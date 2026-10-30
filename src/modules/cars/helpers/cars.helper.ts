import { API_URL } from "@/lib/config";
import type { Car, CarDetail, City } from "@/shared/types/domain";
import { businessTodayIso } from "@/shared/utils/dates";
import { wholeUnitsToCents } from "@/shared/utils/money";
import { carSearchFiltersSchema } from "@/modules/cars/schema/cars.schema";
import type {
  CarSearchFilters,
  CarSort,
} from "@/modules/cars/types/cars.types";
import type { AgencyCarsFilters } from "@/modules/agencies/types/agencies.types";

/**
 * Pure car helpers: the URL ↔ filters round trip, the request params every
 * listing surface sends, the photo URLs and the browsing-order labels.
 * Nothing here talks to the network or to React.
 */

// ── URL ↔ filters ───────────────────────────────────────────────────────────

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Normalize raw Next.js `searchParams` into the stable, serializable object
 * used BOTH as the TanStack Query key part and as the API request params —
 * so a URL change is a new cache entry.
 *
 * Total by construction (see `carSearchFiltersSchema`): anything a crawler,
 * a stale link or a hand-edited address bar can carry degrades to "no
 * filter" instead of throwing.
 */
export function parseCarFilters(sp: RawSearchParams): CarSearchFilters {
  return carSearchFiltersSchema.parse({
    country: sp.country,
    region: sp.region,
    from: sp.from,
    to: sp.to,
    make: sp.make,
    model: sp.model,
    yearMin: sp.year_min,
    yearMax: sp.year_max,
    color: sp.color,
    category: sp.category,
    transmission: sp.transmission,
    priceMin: sp.price_min,
    priceMax: sp.price_max,
    ratingMin: sp.rating_min,
    sort: sp.sort,
    page: sp.page,
  });
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
  set("rating_min", f.ratingMin);
  set("sort", f.sort);
  set("page", f.page);
  return sp;
}

/**
 * WHY A DATE RANGE CANNOT BE SEARCHED — or `null` when it can.
 *
 *  - `incomplete`: one endpoint without the other. Availability is an
 *    anti-join over a window; half a window is not one.
 *  - `past`: the pickup day has already gone. No car can be collected
 *    yesterday, so every result would be a listing nobody can book.
 *  - `backwards`: the return is on or before the pickup. A zero or negative
 *    rental is not a short one.
 *
 * DELIBERATELY NOT IN THE PARSER (BUG-010). `carSearchFiltersSchema` is total
 * by design — it degrades anything it cannot read to `undefined` and never
 * throws, because this is the least trusted input in the app and a 500 on
 * `?page=abc` would break URLs that work. But degrading a PAST range to
 * `undefined` would silently answer a different question: the renter asked
 * about last week and got the undated catalogue, with cars they cannot have.
 * So the dates survive parsing and are CLASSIFIED here, at the two edges that
 * have to act on them — the server page skips the prefetch, the client skips
 * the fetch, and the screen says why.
 *
 * `today` is the BUSINESS day (the backend's timezone), not the device's, so
 * the server and the browser agree on the boundary near midnight.
 */
export type CarSearchRangeProblem = "incomplete" | "past" | "backwards";

export function carSearchRangeProblem(
  filters: Pick<CarSearchFilters, "from" | "to">,
  today: string = businessTodayIso(),
): CarSearchRangeProblem | null {
  const { from, to } = filters;
  // Browsing without dates is a legitimate question (the published catalogue).
  if (!from && !to) return null;
  if (!from || !to) return "incomplete";
  // Checked before the ordering: a range entirely in the past is better
  // described as past than as whatever shape it has.
  if (from < today) return "past";
  if (to <= from) return "backwards";
  return null;
}

/**
 * Whether the URL asks for a DATED availability search that can actually be
 * run. `false` for no dates (browse the catalogue) and for a range this
 * function's sibling rejects.
 */
export function canSearchDates(
  filters: Pick<CarSearchFilters, "from" | "to">,
  today?: string,
): boolean {
  return (
    !!filters.from &&
    !!filters.to &&
    carSearchRangeProblem(filters, today) === null
  );
}

// ── Request params ──────────────────────────────────────────────────────────

// Shared by browser Axios and server fetch: hydration must use identical filters.
//
// `priceMinCents`/`priceMaxCents` are RENTER-facing cents: the backend marks
// each car's host rate up before comparing, so a bound typed against the
// price on the card matches the cars the card shows.
function facets(filters: CarSearchFilters) {
  return {
    make: filters.make,
    model: filters.model,
    yearMin: filters.yearMin,
    yearMax: filters.yearMax,
    color: filters.color,
    category: filters.category,
    transmission: filters.transmission,
    priceMinCents:
      filters.priceMin === undefined
        ? undefined
        : wholeUnitsToCents(filters.priceMin),
    priceMaxCents:
      filters.priceMax === undefined
        ? undefined
        : wholeUnitsToCents(filters.priceMax),
    page: filters.page,
  };
}

/**
 * `ratingMin` and `sort` are NOT in `facets()` on purpose.
 *
 * `facets()` is shared with the agency storefront, whose DTO knows neither
 * parameter — and the API validates with `forbidNonWhitelisted`, so sending
 * one there would 400 the whole storefront rather than be ignored. They are
 * listed here and in `carCatalogParams`, the two surfaces that accept them.
 */
function publicBrowsing(filters: CarSearchFilters) {
  return {
    ratingMin: filters.ratingMin,
    sort: filters.sort,
  };
}

export function carSearchParams(city: string, filters: CarSearchFilters) {
  return {
    ...facets(filters),
    ...publicBrowsing(filters),
    country: filters.country,
    region: filters.region,
    city: city && city !== "all" ? city : undefined,
    start: filters.from,
    end: filters.to,
  };
}

export function agencyCarsParams(filters: AgencyCarsFilters) {
  return {
    ...facets(filters),
    branchId: filters.branchId,
    sort: filters.sort,
    pageSize: filters.pageSize,
  };
}

/** Published inventory only, with no availability/date parameters. */
export function carCatalogParams(city: string, filters: CarSearchFilters) {
  return {
    ...facets(filters),
    ...publicBrowsing(filters),
    country: filters.country,
    region: filters.region,
    city: city && city !== "all" ? city : undefined,
  };
}

// ── Photos ──────────────────────────────────────────────────────────────────

/**
 * Car photo URLs — REAL photos only.
 *
 * The wire serializes uploaded photos as API paths (`/cars/photos/:photoId`
 * — a public streaming endpoint keyed by photo id) and passes seed-era
 * absolute URLs through unchanged. There is NO stock-photo substitution: a
 * car with no photos renders the branded `CarPhotoPlaceholder`, never
 * someone else's car.
 */

/**
 * Resolve one wire photo URL to something an `<img>`/`next/image` can load:
 * absolute http(s) URLs pass through; API paths (`/cars/photos/:id`) are
 * prefixed with the API base (which already ends in `/api` — see lib/config).
 */
export function resolveCarPhotoUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * The primary card photo for a car, or `null` when it has none (callers
 * render the branded placeholder).
 */
export function carPhoto(car: Pick<Car, "primaryPhoto">): string | null {
  return car.primaryPhoto ? resolveCarPhotoUrl(car.primaryPhoto) : null;
}

/** The car's real gallery (resolved URLs, server order). Empty when none. */
export function carGallery(
  car: Pick<CarDetail, "photos" | "primaryPhoto">,
): string[] {
  if (car.photos && car.photos.length > 0) {
    return car.photos.map(resolveCarPhotoUrl);
  }
  // Older payloads may carry only primaryPhoto — still real, never stock.
  const photo = carPhoto(car);
  return photo ? [photo] : [];
}

// ── Destinations ────────────────────────────────────────────────────────────

/**
 * Whether a city can be reached by its SLUG alone. Search sends the country,
 * so only a collision inside the same country is ambiguous — and an
 * ambiguous slug would send the renter to the wrong city's page.
 */
export function hasUniqueCitySlug(city: City, cities: City[]): boolean {
  return (
    cities.filter(
      (candidate) =>
        candidate.slug === city.slug && candidate.countryId === city.countryId,
    ).length === 1
  );
}

// ── Browsing order & rating options ─────────────────────────────────────────

/**
 * HOW THE RESULTS ARE ORDERED, and what each order is called on screen. The
 * values are the wire contract (`carSortSchema`); only the labels live here,
 * so renaming one never changes what is sent.
 *
 * `price_asc` is the default and is DELIBERATELY not labelled "default": it
 * is simply the first option, which is what a renter expects a sort menu to
 * mean.
 */
export const CAR_SORTS: readonly { value: CarSort; label: string }[] = [
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating_desc", label: "Best rated" },
  /**
   * The newest CARS, by model year. Not to be confused with a host who is new
   * to the platform — the card says "No reviews yet" for that, never "New",
   * precisely because the two would sit two lines apart.
   */
  { value: "year_desc", label: "Newest first" },
];

/**
 * MINIMUM HOST RATING.
 *
 * Whole and half stars only. A free-entry number would let a renter ask for
 * "4.37 stars and up", which no host's average will ever satisfy in a way
 * they could predict, and which reads as a bug when the page comes back
 * empty.
 *
 * `undefined` is "Any" — the backend treats a missing minimum and a `0` the
 * same way, and we send nothing rather than `0` so the URL stays clean.
 */
export const RATING_MINIMUMS: readonly {
  value: number | undefined;
  label: string;
}[] = [
  { value: undefined, label: "Any rating" },
  { value: 3, label: "3 stars & up" },
  { value: 4, label: "4 stars & up" },
  { value: 4.5, label: "4.5 stars & up" },
];
