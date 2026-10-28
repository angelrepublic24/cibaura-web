"use client";

import { useState } from "react";

import {
  useAdminCities,
  useAdminCountries,
  useCreateCity,
  usePlatformConfig,
  useUpdateCountryTaxRate,
} from "@/modules/admin/hooks/admin.hook";
import {
  taxRatePctFieldSchema,
} from "@/modules/admin/schema/platform-config.schema";
import { getErrorMessage } from "@/shared/api/errors";
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
import type { Country } from "@/shared/types/domain";
import { formatPct } from "@/shared/utils/money";
/**
 * /admin/geo — the country → city hierarchy that scopes search. Countries are
 * seeded; admins can ADD cities here (e.g. Mao, La Vega). The slug is derived
 * from the name server-side and is what the public search routes use.
 *
 * Countries also carry the TAX RATE their market charges. It is resolved
 * from the car (branch → city → country), not from the renter, so a
 * Dominican renting in Miami pays Florida's rate; a country without one of
 * its own falls back to the platform rate. Bookings snapshot the rate they
 * were quoted at, so editing here never re-prices an existing one.
 */
export default function AdminGeoPage() {
  const countriesQuery = useAdminCountries();
  const citiesQuery = useAdminCities();
  // Only to name the fallback a country with no rate of its own inherits.
  const configQuery = usePlatformConfig();

  const [countryId, setCountryId] = useState("");
  const [name, setName] = useState("");

  // The hook refreshes the city list; clearing the box is this page's own.
  const addCity = useCreateCity();
  const createCity = {
    isPending: addCity.isPending,
    error: addCity.error,
    mutate: () =>
      addCity.mutate(
        { countryId, name: name.trim() },
        { onSuccess: () => setName("") },
      ),
  };

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
                    <CountryTaxRow
                      key={c.id}
                      country={c}
                      platformRatePct={configQuery.data?.taxRatePct}
                    />
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
              {createCity.error ? (
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
                  {(citiesQuery.data ?? []).map((c) => (
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

/**
 * One country row: its code, and the tax rate this market charges. An empty
 * box means the country has NO rate of its own — which is not "tax-free",
 * it is "use the platform rate", so the hint names that figure rather than
 * leaving the admin to guess. The bound is the backend's own
 * (`PLATFORM_CONFIG_LIMITS.taxRatePct`), validated here only so a typo is
 * answered before the round trip.
 */
function CountryTaxRow({
  country,
  platformRatePct,
}: {
  country: Country;
  platformRatePct: number | undefined;
}) {
  const stored = country.taxRatePct === null ? "" : String(country.taxRatePct);
  // The box is the admin's DRAFT, seeded once and re-seeded only from a save
  // — a background refetch must not overwrite a rate being typed.
  const [rate, setRate] = useState(stored);
  const [invalid, setInvalid] = useState<string | null>(null);

  // The hook writes the server's answer into the cached list; re-seeding
  // THIS box from it is the row's own business.
  const saveRate = useUpdateCountryTaxRate();
  const save = {
    isPending: saveRate.isPending,
    error: saveRate.error,
    mutate: (taxRatePct: number | null) =>
      saveRate.mutate(
        { countryId: country.id, taxRatePct },
        {
          onSuccess: (saved) => {
            setRate(saved.taxRatePct === null ? "" : String(saved.taxRatePct));
            setInvalid(null);
          },
        },
      ),
  };

  function submit() {
    if (rate.trim() === "") {
      setInvalid(null);
      save.mutate(null);
      return;
    }
    const parsed = taxRatePctFieldSchema.safeParse(rate);
    if (!parsed.success) {
      // A failed parse always carries an issue; the fallback is for the
      // compiler, which cannot know that.
      setInvalid(
        parsed.error.issues[0]?.message ?? "Enter a percentage, e.g. 18 or 18.5",
      );
      return;
    }
    setInvalid(null);
    save.mutate(Number(parsed.data));
  }

  const dirty = rate.trim() !== stored;
  const fallback =
    platformRatePct === undefined ? "" : ` (${formatPct(platformRatePct)})`;

  return (
    <li className="space-y-1.5 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto">{country.name}</span>
        <span className="text-xs uppercase text-muted-foreground">
          {country.code}
        </span>
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`tax-${country.id}`} className="sr-only">
            {country.name} tax rate
          </Label>
          <Input
            id={`tax-${country.id}`}
            className="h-8 w-24"
            inputMode="decimal"
            placeholder="Platform"
            aria-invalid={!!invalid}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!dirty || save.isPending}
            onClick={submit}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {invalid ? (
        <p className="text-xs text-destructive">{invalid}</p>
      ) : save.error ? (
        <p className="text-xs text-destructive" role="alert">
          {getErrorMessage(save.error, "Could not save the tax rate.")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {country.taxRatePct === null
            ? `No rate of its own — charging the platform rate${fallback}.`
            : `Clear the box to go back to the platform rate${fallback}.`}
        </p>
      )}
    </li>
  );
}
