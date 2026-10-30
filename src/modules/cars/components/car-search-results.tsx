"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hasSearchDates,
  useCarListing,
} from "@/modules/cars/hooks/cars.hook";
import {
  carSearchRangeProblem,
  type CarSearchRangeProblem,
} from "@/modules/cars/helpers/cars.helper";
import { filtersToSearchParams } from "@/modules/cars/helpers/cars.helper";
import type { CarSearchFilters } from "@/modules/cars/types/cars.types";
import { CarFiltersPanel } from "@/modules/cars/components/car-filters-panel";
import { CarCard } from "@/modules/cars/components/car-card";
import { SearchModeToggle } from "@/shared/components/search-mode-toggle";
import { useCities, useCountries } from "@/modules/catalog/hooks/catalog.hook";
import type { Car } from "@/shared/types/domain";
import { formatIsoDate, businessTodayIso } from "@/shared/utils/dates";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { DestinationFields, type Destination } from "./destination-fields";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Select } from "@/shared/components/ui/select";
import { CAR_SORTS } from "@/modules/cars/helpers/cars.helper";
import type { CarSort } from "@/modules/cars/types/cars.types";

/**
 * Results grid for /cars/[city]. The URL is the single source of truth:
 * every filter change rewrites the search params (router.replace) and the
 * TanStack Query key is derived from (city, filters), so back/forward and
 * shared links replay the exact same search.
 */
export function CarSearchResults({
  city,
  cityName,
  filters,
}: {
  city: string;
  cityName?: string;
  filters: CarSearchFilters;
}) {
  const router = useRouter();

  // Availability is a server-side anti-join, so the backend REQUIRES a date
  // range (`start`/`end`): with both, the hook searches; without, it falls
  // back to the published catalog without claiming availability.
  const hasDates = hasSearchDates(filters);
  /*
   * A RANGE THE URL ASKED FOR THAT CANNOT BE SEARCHED (BUG-010).
   *
   * Hand-edited addresses, stale links and shared itineraries all arrive here
   * with dates that have since gone by. The hook refuses to fetch for one, so
   * this is the screen saying which range it refused and why — the one thing
   * the old behaviour never did: it dropped to the undated catalogue and
   * showed cars, which reads as availability for days nobody can book.
   */
  const rangeProblem = carSearchRangeProblem(filters);
  const query = useCarListing(city, filters);

  function applyFilters(next: CarSearchFilters) {
    const sp = filtersToSearchParams({
      ...next,
      country: filters.country,
      region: filters.region,
      page: undefined,
    });
    const qs = sp.toString();
    router.replace(`/cars/${encodeURIComponent(city)}${qs ? `?${qs}` : ""}`);
  }

  function applyTrip(nextCity: string, next: CarSearchFilters) {
    const qs = filtersToSearchParams({ ...next, page: undefined }).toString();
    router.replace(
      `/cars/${encodeURIComponent(nextCity || "all")}${qs ? `?${qs}` : ""}`,
    );
  }

  function goToPage(page: number) {
    const sp = filtersToSearchParams({ ...filters, page });
    router.replace(`/cars/${encodeURIComponent(city)}?${sp.toString()}`);
  }

  const total = query.data?.total ?? 0;
  const page = filters.page ?? 1;
  const pageSize = query.data?.pageSize ?? 12;
  const hasNext = page * pageSize < total;

  // Detail URL is agency-scoped, Beusun-style: /agencies/<slug>/cars/<id>.
  // Trip dates ride along in the query string so the detail page pre-fills them.
  function carHref(car: Car) {
    const sp = filtersToSearchParams({ from: filters.from, to: filters.to });
    const qs = sp.toString();
    return `/agencies/${car.agency.slug}/cars/${car.id}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {rangeProblem
              ? "Check your dates"
              : hasDates
                ? "Available cars"
                : "Car catalog"}
          </p>
          <h1 className="font-display mt-1 text-3xl capitalize text-foreground">
            {cityName ?? (city === "all" ? "All cities" : city)}
          </h1>
        </div>
        <div className="text-right">
          {rangeProblem ? (
            <p className="text-sm font-medium text-foreground">
              {formatIsoDate(filters.from) || "—"} →{" "}
              {formatIsoDate(filters.to) || "—"}
            </p>
          ) : hasDates ? (
            <>
              <p className="text-sm font-medium text-foreground">
                {formatIsoDate(filters.from)} → {formatIsoDate(filters.to)}
              </p>
              {query.data ? (
                <p className="text-sm text-muted-foreground">
                  {total} car{total === 1 ? "" : "s"} found
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Browse cars now. Choose dates to check availability.
            </p>
          )}
        </div>
      </header>

      {/* Date range is first-class: the server only returns cars free for the
          whole window, so we ask for dates up front. */}
      <DateRangeBar filters={filters} onApply={applyTrip} city={city} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          {/* Search agencies instead — reachable from the filter, not the nav. */}
          <SearchModeToggle mode="cars" city={city} />
          <CarFiltersPanel filters={filters} onApply={applyFilters} />
        </aside>

        <section>
          {/* Order — a peer of the filters, not one of them: it lives over
              the results it reorders, and it applies on change rather than
              waiting for "Apply filters". */}
          <div className="mb-4 flex items-center justify-end gap-2">
            <Label htmlFor="sort" className="text-sm text-muted-foreground">
              Sort by
            </Label>
            <Select
              id="sort"
              className="w-auto min-w-[11rem]"
              value={filters.sort ?? "price_asc"}
              onChange={(e) =>
                applyFilters({ ...filters, sort: e.target.value as CarSort })
              }
            >
              {CAR_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          {rangeProblem ? (
            <RangeProblemNotice
              problem={rangeProblem}
              onBrowseUndated={() =>
                applyTrip(city, {
                  ...filters,
                  from: undefined,
                  to: undefined,
                })
              }
            />
          ) : query.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CarCardSkeleton key={i} />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState
              title="Search failed"
              message={query.error.message}
              onRetry={() => query.refetch()}
            />
          ) : (query.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="No cars match your search"
              description="Try widening the dates or clearing some filters."
              action={
                <Button
                  variant="outline"
                  // Clear the facets but KEEP the trip (dates + order), the
                  // same way the filter panel's "Clear all" does — otherwise
                  // this silently drops the dates and flips the page back to
                  // the catalog.
                  onClick={() =>
                    applyFilters({
                      from: filters.from,
                      to: filters.to,
                      sort: filters.sort,
                    })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {(query.data?.items ?? []).map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    href={carHref(car)}
                    agencyHref={`/agencies/${car.agency.slug}`}
                  />
                ))}
              </div>

              {(page > 1 || hasNext) && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function CarCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  );
}

/**
 * WHY THESE DATES RETURNED NOTHING — in place of the results (BUG-010).
 *
 * Deliberately NOT an empty state: "no cars match" would blame the inventory
 * for a question that was never askable. And deliberately not a silent
 * fallback to the catalogue either, which is what used to happen — the cars
 * it listed were real, but presenting them under a past range implied they
 * could be booked for it.
 *
 * The way out is right above (the date bar, which cannot submit a past day),
 * plus one button for the reading that is always available: the same city
 * without dates.
 */
function RangeProblemNotice({
  problem,
  onBrowseUndated,
}: {
  problem: CarSearchRangeProblem;
  onBrowseUndated: () => void;
}) {
  const copy: Record<CarSearchRangeProblem, { title: string; description: string }> = {
    past: {
      title: "Those dates have already passed",
      description:
        "A car can only be picked up today or later, so there is nothing to show for that range. Choose new dates above.",
    },
    backwards: {
      title: "The return date is not after the pickup date",
      description:
        "A rental needs at least one day. Set a return date later than the pickup and search again.",
    },
    incomplete: {
      title: "That link is missing one of the dates",
      description:
        "Availability is checked for a whole range, so both the pickup and the return are needed. Add the missing one above.",
    },
  };
  const { title, description } = copy[problem];
  return (
    <div
      role="alert"
      className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-6"
    >
      <h2 className="font-medium text-amber-900">{title}</h2>
      <p className="mt-1 text-sm text-amber-900/80">{description}</p>
      <Button variant="outline" className="mt-4" onClick={onBrowseUndated}>
        Browse this city without dates
      </Button>
    </div>
  );
}

/**
 * Pickup/return date range for the results page. Dates are first-class: the
 * server only returns cars free for the whole window, so this bar stays at the
 * top and applying it re-runs the search. Preserves all other active facets.
 */
function DateRangeBar({
  filters,
  onApply,
  city,
}: {
  filters: CarSearchFilters;
  onApply: (city: string, next: CarSearchFilters) => void;
  city: string;
}) {
  const countriesQuery = useCountries();
  const citiesQuery = useCities();
  // Legacy city URLs have no country parameter. Resolve it from API data, never the slug.
  const matches = citiesQuery.data?.filter((item) => item.slug === city) ?? [];
  const inferredCountry =
    matches.length === 1
      ? countriesQuery.data?.find((item) => item.id === matches[0]?.countryId)
          ?.code
      : undefined;
  const initialCountry = filters.country ?? inferredCountry ?? "";
  const [destination, setDestination] = useState<Destination | null>(null);
  const selected = destination ?? {
    country: initialCountry,
    region: filters.region ?? "",
    city: city === "all" ? "" : city,
  };
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");

  useEffect(() => {
    setDestination(null);
    setFrom(filters.from ?? "");
    setTo(filters.to ?? "");
  }, [city, filters.country, filters.region, filters.from, filters.to]);

  /*
   * The same rule the URL is held to (BUG-010), so the bar cannot put a range
   * back that the results panel just refused — `min` on the inputs stops the
   * picker, but a date can still be typed into them.
   */
  const dateProblem = carSearchRangeProblem({ from, to });
  const ready = !!selected.country && dateProblem === null;
  const action = !selected.country
    ? "Choose a country"
    : dateProblem === "past"
      ? "Choose a pickup date from today"
      : dateProblem === "incomplete"
        ? !from
          ? "Choose pickup date"
          : "Choose return date"
        : dateProblem === "backwards"
          ? "Choose a later return date"
          : "Apply";

  return (
    <form
      aria-label="Edit destination and dates"
      className="mt-5 grid grid-cols-1 items-end gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready)
          onApply(selected.city, {
            ...filters,
            country: selected.country,
            region: selected.region || undefined,
            from: from || undefined,
            to: to || undefined,
            page: undefined,
          });
      }}
    >
      <DestinationFields
        {...selected}
        idPrefix="sr"
        showCityRegions
        onDestinationChange={setDestination}
      />
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="sr-from">Pickup date (optional)</Label>
        <Input
          id="sr-from"
          type="date"
          min={businessTodayIso()}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="sr-to">Return date (optional)</Label>
        <Input
          id="sr-to"
          type="date"
          min={from || businessTodayIso()}
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={!ready}>
        {action}
      </Button>
    </form>
  );
}
