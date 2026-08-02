"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Card, CardContent } from "@/shared/components/ui/card";

/**
 * /admin/geo — read-only view of the seeded geo hierarchy (countries → cities).
 * Search is city-scoped and cities carry the URL slug used by the public
 * routes. Adding a country/city is a data/seed operation, not an admin action
 * in v1, so this surface is read-only.
 */
export default function AdminGeoPage() {
  const countriesQuery = useQuery({
    queryKey: adminKeys.countries(),
    queryFn: AdminApi.listCountries,
  });

  const citiesQuery = useQuery({
    queryKey: adminKeys.cities(),
    queryFn: AdminApi.listCities,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Geo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The country → city hierarchy that scopes search. Managed via seeds;
        read-only here.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold">Countries</h2>
            <div className="mt-3">
              {countriesQuery.isLoading ? (
                <LoadingState label="Loading countries…" className="py-6" />
              ) : countriesQuery.isError ? (
                <ErrorState
                  title="Could not load countries"
                  message={countriesQuery.error.message}
                  onRetry={() => countriesQuery.refetch()}
                />
              ) : (countriesQuery.data?.length ?? 0) === 0 ? (
                <EmptyState title="No countries seeded" className="py-6" />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {countriesQuery.data!.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs uppercase text-muted-foreground">
                        {c.code}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold">Cities</h2>
            <div className="mt-3">
              {citiesQuery.isLoading ? (
                <LoadingState label="Loading cities…" className="py-6" />
              ) : citiesQuery.isError ? (
                <ErrorState
                  title="Could not load cities"
                  message={citiesQuery.error.message}
                  onRetry={() => citiesQuery.refetch()}
                />
              ) : (citiesQuery.data?.length ?? 0) === 0 ? (
                <EmptyState title="No cities seeded" className="py-6" />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {citiesQuery.data!.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        /{c.slug}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
