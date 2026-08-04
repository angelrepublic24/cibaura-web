"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import {
  AgenciesApi,
  agencyProfileKeys,
  type AgencyDirectoryFilters,
  type AgencyDirectorySort,
} from "@/features/agencies/api";
import { agencyDirectoryFiltersToSearchParams } from "@/features/agencies/filters";
import { AgencyPublicCard } from "@/features/agencies/components/agency-public-card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { SearchModeToggle } from "@/shared/components/search-mode-toggle";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * Public agency directory. Same faceted shell as the car search — a left filter
 * panel + a results grid + pagination, with the URL as the single source of
 * truth (router.replace on every change; the TanStack key derives from filters).
 */
const SORTS: { value: AgencyDirectorySort; label: string }[] = [
  { value: "top_rated", label: "Top rated" },
  { value: "most_reviews", label: "Most reviews" },
  { value: "name", label: "Name (A–Z)" },
];

export function AgencyDirectory({
  filters,
}: {
  filters: AgencyDirectoryFilters;
}) {
  const router = useRouter();

  const citiesQuery = useQuery({
    queryKey: agencyProfileKeys.availableCities(),
    queryFn: AgenciesApi.availableCities,
  });

  const query = useQuery({
    queryKey: agencyProfileKeys.directory(filters),
    queryFn: () => AgenciesApi.directory(filters),
  });

  function apply(next: AgencyDirectoryFilters) {
    const qs = agencyDirectoryFiltersToSearchParams({
      ...next,
      page: undefined,
    }).toString();
    router.replace(`/agencies${qs ? `?${qs}` : ""}`);
  }

  function goToPage(page: number) {
    const qs = agencyDirectoryFiltersToSearchParams({
      ...filters,
      page,
    }).toString();
    router.replace(`/agencies${qs ? `?${qs}` : ""}`);
  }

  const agencies = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const page = filters.page ?? 1;
  const pageSize = query.data?.pageSize ?? 24;
  const hasNext = page * pageSize < total;
  const activeCount = (filters.city ? 1 : 0) + (filters.sort ? 1 : 0);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Directory
          </p>
          <h1 className="font-display mt-1 text-3xl text-foreground">
            Agencies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified rent-a-car agencies — browse by city and rating.
          </p>
        </div>
        {query.data ? (
          <p className="text-sm text-muted-foreground">
            {total} agenc{total === 1 ? "y" : "ies"}
          </p>
        ) : null}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <SearchModeToggle mode="agencies" city={filters.city} />
          {/* Same faceted-panel language as the car search filters. */}
          <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  Filters
                </h2>
                {activeCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {activeCount}
                  </span>
                ) : null}
              </div>
              {activeCount > 0 ? (
                <button
                  type="button"
                  onClick={() => apply({})}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            <div className="space-y-6 p-5">
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Location
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="dir-city" className="text-xs text-muted-foreground">
                    City
                  </Label>
                  <Select
                    id="dir-city"
                    value={filters.city ?? ""}
                    onChange={(e) =>
                      apply({ ...filters, city: e.target.value || undefined })
                    }
                  >
                    <option value="">All cities</option>
                    {/* Keep a URL city selectable even if it has no availability
                        now, so the dropdown never mislabels the active filter. */}
                    {filters.city &&
                    !(citiesQuery.data ?? []).some(
                      (c) => c.slug === filters.city,
                    ) ? (
                      <option value={filters.city} className="capitalize">
                        {filters.city.replace(/-/g, " ")}
                      </option>
                    ) : null}
                    {(citiesQuery.data ?? []).map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sort
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="dir-sort" className="text-xs text-muted-foreground">
                    Order by
                  </Label>
                  <Select
                    id="dir-sort"
                    value={filters.sort ?? ""}
                    onChange={(e) =>
                      apply({
                        ...filters,
                        sort: (e.target.value || undefined) as
                          | AgencyDirectorySort
                          | undefined,
                      })
                    }
                  >
                    <option value="">Recommended</option>
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section>
          {query.isLoading ? (
            <LoadingState label="Loading agencies…" className="py-16" />
          ) : query.isError ? (
            <ErrorState
              title="Could not load agencies"
              message={(query.error as Error).message}
              onRetry={() => query.refetch()}
            />
          ) : agencies.length === 0 ? (
            <EmptyState
              title="No agencies here yet"
              description="Try another city — or check back soon."
              className="py-16"
              action={
                activeCount > 0 ? (
                  <Button variant="outline" onClick={() => apply({})}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {agencies.map((a) => (
                  <AgencyPublicCard key={a.id} agency={a} />
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
