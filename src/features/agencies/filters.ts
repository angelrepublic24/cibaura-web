/**
 * Agency URL filters — the URL is the source of truth (shareable + back/forward
 * replays the exact search), exactly like the car search (`features/cars/filters`).
 *
 * Two surfaces:
 *  - the agency STOREFRONT catalog (`/agencies/[slug]?make=…&year_min=…&sort=…`)
 *    reuses the car facets verbatim, minus dates, plus a catalog sort;
 *  - the agency DIRECTORY (`/agencies?city=…&sort=…`).
 */
import {
  parseCarFilters,
  filtersToSearchParams,
} from "@/features/cars/filters";
import type {
  AgencyCarsFilters,
  AgencyCarsSort,
  AgencyDirectoryFilters,
  AgencyDirectorySort,
} from "@/features/agencies/api";

type RawSearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim().length > 0 ? s.trim() : undefined;
}

// ── Storefront catalog ────────────────────────────────────────────────────

const CAR_SORTS: AgencyCarsSort[] = ["price_asc", "price_desc", "year_desc"];

/** Same faceting as car search (make/model/year/specs/price) + a catalog sort. */
export function parseAgencyCarFilters(sp: RawSearchParams): AgencyCarsFilters {
  const base = parseCarFilters(sp);
  const sortRaw = one(sp.sort);
  const sort = CAR_SORTS.includes(sortRaw as AgencyCarsSort)
    ? (sortRaw as AgencyCarsSort)
    : undefined;
  // A storefront is a catalog, not an availability search — drop any dates.
  return { ...base, from: undefined, to: undefined, sort };
}

export function agencyCarFiltersToSearchParams(
  f: AgencyCarsFilters,
): URLSearchParams {
  const sp = filtersToSearchParams({ ...f, from: undefined, to: undefined });
  if (f.sort) sp.set("sort", f.sort);
  return sp;
}

// ── Directory ─────────────────────────────────────────────────────────────

const DIR_SORTS: AgencyDirectorySort[] = ["top_rated", "most_reviews", "name"];

export function parseAgencyDirectoryFilters(
  sp: RawSearchParams,
): AgencyDirectoryFilters {
  const sortRaw = one(sp.sort);
  const sort = DIR_SORTS.includes(sortRaw as AgencyDirectorySort)
    ? (sortRaw as AgencyDirectorySort)
    : undefined;
  const pageRaw = one(sp.page);
  const page =
    pageRaw && Number.isFinite(Number(pageRaw)) ? Number(pageRaw) : undefined;
  return { city: one(sp.city), sort, page };
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
