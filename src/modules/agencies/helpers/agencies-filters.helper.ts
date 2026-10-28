/**
 * Agency URL filters — the URL is the source of truth (shareable + back/forward
 * replays the exact search), exactly like the car search (`modules/cars`).
 *
 * Two surfaces:
 *  - the agency STOREFRONT catalog (`/agencies/[slug]?make=…&year_min=…&sort=…`)
 *    reuses the car facets verbatim, minus dates, plus a catalog sort;
 *  - the agency DIRECTORY (`/agencies?city=…&sort=…`).
 */
import { filtersToSearchParams, parseCarFilters } from "@/modules/cars/helpers/cars.helper";
import { urlEnum, urlNumber, urlText } from "@/modules/cars/schema/cars.schema";
import type { AgencyCarsFilters, AgencyCarsSort, AgencyDirectoryFilters, AgencyDirectorySort } from "@/modules/agencies/types/agencies.types";

type RawSearchParams = Record<string, string | string[] | undefined>;

// ── Storefront catalog ────────────────────────────────────────────────────

/**
 * The same zod field schemas the car search uses (`modules/cars`):
 * one definition of "a URL string", "a URL number" and "a URL enum", all of
 * them degrading to `undefined` instead of throwing.
 */
const carSortParam = urlEnum<AgencyCarsSort>([
  "price_asc",
  "price_desc",
  "year_desc",
]);

/** Same faceting as car search (make/model/year/specs/price) + branch + sort. */
export function parseAgencyCarFilters(sp: RawSearchParams): AgencyCarsFilters {
  const base = parseCarFilters(sp);
  // A storefront is a catalog, not an availability search — drop any dates.
  return {
    ...base,
    from: undefined,
    to: undefined,
    branchId: urlText.parse(sp.branch),
    sort: carSortParam.parse(sp.sort),
  };
}

export function agencyCarFiltersToSearchParams(
  f: AgencyCarsFilters,
): URLSearchParams {
  const sp = filtersToSearchParams({ ...f, from: undefined, to: undefined });
  if (f.branchId) sp.set("branch", f.branchId);
  if (f.sort) sp.set("sort", f.sort);
  return sp;
}

// ── Directory ─────────────────────────────────────────────────────────────

const directorySortParam = urlEnum<AgencyDirectorySort>([
  "top_rated",
  "most_reviews",
  "name",
]);

export function parseAgencyDirectoryFilters(
  sp: RawSearchParams,
): AgencyDirectoryFilters {
  return {
    city: urlText.parse(sp.city),
    sort: directorySortParam.parse(sp.sort),
    page: urlNumber.parse(sp.page),
  };
}

export function agencyDirectoryFiltersToSearchParams(
  f: AgencyDirectoryFilters,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.city) sp.set("city", f.city);
  if (f.sort) sp.set("sort", f.sort);
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  return sp;
}
