"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { DestinationFields } from "./destination-fields";
import { filtersToSearchParams } from "@/features/cars/filters";
import { CAR_CATEGORIES } from "@/shared/types/domain";
import { todayIso } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Home search: destination country/city, optional dates and category facets.
 * Submitting navigates to /cars/[city]?from&to[&category] — the results
 * page derives its query key from those URL params.
 */
export function HeroSearch() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  const hasDates = !!from && !!to && to > from && from >= todayIso();
  const noDates = !from && !to;
  const canSearch = !!city && (noDates || hasDates);

  function browse() {
    if (!city) return;
    const qs = filtersToSearchParams({ category }).toString();
    router.push(`/cars/${encodeURIComponent(city)}${qs ? `?${qs}` : ""}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    const sp = filtersToSearchParams({
      from: from || undefined,
      to: to || undefined,
      category,
    });
    const qs = sp.toString();
    router.push(`/cars/${encodeURIComponent(city)}${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-lg md:p-6"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-start">
        <DestinationFields city={city} onCityChange={setCity} />

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

        <Button
          type="submit"
          size="lg"
          disabled={!canSearch}
          className="w-full md:w-auto"
        >
          <Search className="h-4 w-4" />
          {noDates ? "Browse cars" : "Check availability"}
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Dates are optional for browsing. Add pickup and return dates to check
        availability.
      </p>
      {city && !noDates && !hasDates ? (
        <div className="mt-2 text-sm" role="status">
          Choose a valid pickup and later return date, or{" "}
          <button type="button" className="underline" onClick={browse}>
            browse without dates
          </button>
          .
        </div>
      ) : null}

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
