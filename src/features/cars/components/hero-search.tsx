"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AgenciesApi, agencyProfileKeys } from "@/features/agencies/api";
import { filtersToSearchParams } from "@/features/cars/filters";
import { CAR_CATEGORIES } from "@/shared/types/domain";
import { todayIso } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Home hero search: city + date range + quick category facets.
 * Submitting navigates to /cars/[city]?from&to[&category] — the results
 * page derives its query key from those URL params.
 */
export function HeroSearch() {
  const router = useRouter();
  const [city, setCity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  // Only cities that actually have available cars.
  const citiesQuery = useQuery({
    queryKey: agencyProfileKeys.availableCities(),
    queryFn: AgenciesApi.availableCities,
  });

  // Dates are first-class: the results search is a server-side availability
  // anti-join and REQUIRES a range. City is OPTIONAL — "all" searches everywhere.
  const canSearch = !!from && !!to && to > from;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    const sp = filtersToSearchParams({ from, to, category });
    const qs = sp.toString();
    router.push(`/cars/${city}${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-lg md:p-6"
    >
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="hero-city">City</Label>
          {citiesQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              id="hero-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="all">
                {citiesQuery.isError
                  ? "Could not load cities — searching everywhere"
                  : "All cities"}
              </option>
              {(citiesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hero-from">Pickup date</Label>
          <Input
            id="hero-from"
            type="date"
            min={todayIso()}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hero-to">Return date</Label>
          <Input
            id="hero-to"
            type="date"
            min={from || todayIso()}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" disabled={!canSearch} className="w-full md:w-auto">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>

      {/* Quick facets: preselect a category before searching. */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Popular
        </span>
        {CAR_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory((prev) => (prev === c ? undefined : c))}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
              category === c
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border text-muted-foreground hover:border-border-strong hover:bg-muted hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </form>
  );
}
