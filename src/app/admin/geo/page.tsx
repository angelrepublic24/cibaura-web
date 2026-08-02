"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * /admin/geo — the country → city hierarchy that scopes search. Countries are
 * seeded; admins can ADD cities here (e.g. Mao, La Vega). The slug is derived
 * from the name server-side and is what the public search routes use.
 */
export default function AdminGeoPage() {
  const qc = useQueryClient();

  const countriesQuery = useQuery({
    queryKey: adminKeys.countries(),
    queryFn: AdminApi.listCountries,
  });
  const citiesQuery = useQuery({
    queryKey: adminKeys.cities(),
    queryFn: AdminApi.listCities,
  });

  const [countryId, setCountryId] = useState("");
  const [name, setName] = useState("");

  const createCity = useMutation({
    mutationFn: () => AdminApi.createCity({ countryId, name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.cities() });
      setName("");
    },
  });

  // Default the country select to the first (usually only) country once loaded.
  const countries = countriesQuery.data ?? [];
  const effectiveCountryId = countryId || countries[0]?.id || "";
  const canCreate = !!effectiveCountryId && name.trim().length >= 2;

  return (
    <div>
      <h1 className="text-2xl font-bold">Geo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The country → city hierarchy that scopes search. Add the cities your
        agencies operate in; the URL slug is generated from the name.
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
              ) : countries.length === 0 ? (
                <EmptyState title="No countries seeded" className="py-6" />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {countries.map((c) => (
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

            {/* Add-city form */}
            <form
              className="mt-3 space-y-2 rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (canCreate) createCity.mutate();
              }}
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="new-city-country" className="text-xs">
                    Country
                  </Label>
                  <Select
                    id="new-city-country"
                    value={effectiveCountryId}
                    onChange={(e) => setCountryId(e.target.value)}
                    disabled={countries.length === 0}
                  >
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-city-name" className="text-xs">
                    City name
                  </Label>
                  <Input
                    id="new-city-name"
                    placeholder="e.g. Mao"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={!canCreate || createCity.isPending}>
                  {createCity.isPending ? "Adding…" : "Add city"}
                </Button>
              </div>
              {createCity.isError ? (
                <p className="text-sm text-destructive">
                  {(createCity.error as Error).message}
                </p>
              ) : null}
            </form>

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
                <EmptyState title="No cities yet — add one above" className="py-6" />
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
