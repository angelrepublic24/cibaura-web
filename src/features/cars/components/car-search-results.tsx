"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CarsApi, carKeys } from "@/features/cars/api";
import {
  filtersToSearchParams,
  type CarSearchFilters,
} from "@/features/cars/filters";
import { CarFiltersPanel } from "@/features/cars/components/car-filters-panel";
import { CarCard } from "@/features/cars/components/car-card";
import { SearchModeToggle } from "@/shared/components/search-mode-toggle";
import { DestinationsApi, destinationKeys } from "../destinations";
import type { Car } from "@/shared/types/domain";
import { formatIsoDate, todayIso } from "@/shared/utils/dates";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { DestinationFields, type Destination } from "./destination-fields";
import { Skeleton } from "@/shared/components/ui/skeleton";

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
  // range (`start`/`end`). Only fire the search once both are present;
  // otherwise fetch the published catalog without claiming availability.
  const hasDates = !!filters.from && !!filters.to && filters.to > filters.from;

  const query = useQuery({
    queryKey: hasDates
      ? carKeys.search(city, filters)
      : carKeys.catalog(city, filters),
    queryFn: () =>
      hasDates ? CarsApi.search(city, filters) : CarsApi.catalog(city, filters),
  });

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
            {hasDates ? "Available cars" : "Car catalog"}
          </p>
          <h1 className="font-display mt-1 text-3xl capitalize text-foreground">
            {cityName ?? (city === "all" ? "All cities" : city)}
          </h1>
        </div>
        <div className="text-right">
          {hasDates ? (
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
          {query.isLoading ? (
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
                <Button variant="outline" onClick={() => applyFilters({})}>
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
  const countriesQuery = useQuery({
    queryKey: destinationKeys.countries,
    queryFn: DestinationsApi.countries,
  });
  const citiesQuery = useQuery({
    queryKey: destinationKeys.cities,
    queryFn: () => DestinationsApi.cities(),
  });
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

  const validDates = (!from && !to) || (!!from && !!to && to > from);
  const ready = !!selected.country && validDates;
  const action = !selected.country
    ? "Choose a country"
    : !validDates
      ? !from
        ? "Choose pickup date"
        : "Choose return date"
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
          min={todayIso()}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="sr-to">Return date (optional)</Label>
        <Input
          id="sr-to"
          type="date"
          min={from || todayIso()}
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
