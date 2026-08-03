"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { CarsApi, carKeys } from "@/features/cars/api";
import { CatalogApi, catalogKeys } from "@/features/catalog/api";
import {
  filtersToSearchParams,
  type CarSearchFilters,
} from "@/features/cars/filters";
import { CarFiltersPanel } from "@/features/cars/components/car-filters-panel";
import { CarCard } from "@/features/cars/components/car-card";
import type { Car, City } from "@/shared/types/domain";
import { formatIsoDate, todayIso } from "@/shared/utils/dates";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Results grid for /cars/[city]. The URL is the single source of truth:
 * every filter change rewrites the search params (router.replace) and the
 * TanStack Query key is derived from (city, filters), so back/forward and
 * shared links replay the exact same search.
 */
export function CarSearchResults({
  city,
  filters,
}: {
  city: string;
  filters: CarSearchFilters;
}) {
  const router = useRouter();

  // Availability is a server-side anti-join, so the backend REQUIRES a date
  // range (`start`/`end`). Only fire the search once both are present;
  // otherwise prompt for dates instead of sending a request that 400s.
  const hasDates = !!filters.from && !!filters.to;

  const query = useQuery({
    queryKey: carKeys.search(city, filters),
    queryFn: () => CarsApi.search(city, filters),
    enabled: hasDates,
  });

  const citiesQuery = useQuery({
    queryKey: catalogKeys.cities(),
    queryFn: CatalogApi.listCities,
  });

  function applyFilters(next: CarSearchFilters) {
    const sp = filtersToSearchParams({ ...next, page: undefined });
    const qs = sp.toString();
    router.replace(`/cars/${encodeURIComponent(city)}${qs ? `?${qs}` : ""}`);
  }

  // Switch city in place (keeps the current dates + facets) and re-search.
  function changeCity(nextCity: string) {
    if (nextCity === city) return;
    const sp = filtersToSearchParams({ ...filters, page: undefined });
    const qs = sp.toString();
    router.replace(
      `/cars/${encodeURIComponent(nextCity)}${qs ? `?${qs}` : ""}`,
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
            Available cars
          </p>
          <h1 className="font-display mt-1 text-3xl capitalize text-foreground">
            {city === "all" ? "All cities" : city}
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
              Pick your dates to see available cars
            </p>
          )}
        </div>
      </header>

      {/* Date range is first-class: the server only returns cars free for the
          whole window, so we ask for dates up front. */}
      <DateRangeBar
        filters={filters}
        onApply={applyFilters}
        city={city}
        cities={citiesQuery.data ?? []}
        onCityChange={changeCity}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <CarFiltersPanel filters={filters} onApply={applyFilters} />
        </aside>

        <section>
          {!hasDates ? (
            <EmptyState
              title="Choose your rental dates"
              description="Availability depends on your pickup and return dates — set them above to see cars that are free for your whole trip."
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
                <Button variant="outline" onClick={() => applyFilters({})}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {query.data!.items.map((car) => (
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
  cities,
  onCityChange,
}: {
  filters: CarSearchFilters;
  onApply: (next: CarSearchFilters) => void;
  city: string;
  cities: City[];
  onCityChange: (slug: string) => void;
}) {
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");

  useEffect(() => {
    setFrom(filters.from ?? "");
    setTo(filters.to ?? "");
  }, [filters.from, filters.to]);

  const ready = !!from && !!to && to > from;

  return (
    <form
      className="mt-5 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onApply({ ...filters, from, to });
      }}
    >
      <span className="hidden items-center gap-2 pb-2.5 pr-1 text-sm font-medium text-muted-foreground sm:inline-flex">
        <SlidersHorizontal className="h-4 w-4" />
        Trip
      </span>
      {/* City is editable in place — change it and the search re-runs. */}
      <div className="space-y-1.5">
        <Label htmlFor="sr-city">City</Label>
        <Select
          id="sr-city"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
        >
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-from">Pickup date</Label>
        <Input
          id="sr-from"
          type="date"
          min={todayIso()}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-to">Return date</Label>
        <Input
          id="sr-to"
          type="date"
          min={from || todayIso()}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={!ready}>
        {filters.from && filters.to ? "Update dates" : "Search dates"}
      </Button>
    </form>
  );
}
