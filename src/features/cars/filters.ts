/**
 * Car search filters — the URL is the source of truth (shareable + SEO):
 * `/cars/santiago?from=2026-08-01&to=2026-08-05&make=toyota&year_min=2022`.
 *
 * `parseCarFilters` normalizes raw Next.js `searchParams` into a stable,
 * serializable object that is used BOTH as the TanStack Query key part
 * and as the API request params — so a URL change is a new cache entry.
 */
import { isIsoDate } from "@/shared/utils/dates";

export interface CarSearchFilters {
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

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim().length > 0 ? s.trim() : undefined;
}

function num(v: string | string[] | undefined): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function parseCarFilters(sp: RawSearchParams): CarSearchFilters {
  const from = str(sp.from);
  const to = str(sp.to);
  return {
    from: isIsoDate(from) ? from : undefined,
    to: isIsoDate(to) ? to : undefined,
    make: str(sp.make),
    model: str(sp.model),
    yearMin: num(sp.year_min),
    yearMax: num(sp.year_max),
    color: str(sp.color),
    category: str(sp.category),
    transmission: str(sp.transmission),
    priceMin: num(sp.price_min),
    priceMax: num(sp.price_max),
    page: num(sp.page),
  };
}

/** Serialize filters back into URL search params (skips empty values). */
export function filtersToSearchParams(f: CarSearchFilters): URLSearchParams {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  };
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
