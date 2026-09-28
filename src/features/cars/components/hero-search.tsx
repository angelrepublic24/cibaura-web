"use client";

import { useQuery } from "@tanstack/react-query";
import { DestinationsApi, destinationKeys } from "../destinations";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";
import { DestinationFields } from "./destination-fields";
import { filtersToSearchParams } from "@/features/cars/filters";
import { CAR_CATEGORIES } from "@/shared/types/domain";
import { todayIso } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import { DateRangePicker } from "@/shared/components/date-range-picker";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Home search: destination country/city, optional dates and category facets.
 * Submitting navigates to /cars/[city]?from&to[&category] — the results
 * page derives its query key from those URL params.
 */
export function HeroSearch({ layout = "B" }: { layout?: "A" | "B" } = {}) {
  const router = useRouter();
  const [editing, setEditing] = useState<"from" | "to" | null>(null);
  const [city, setCity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  const [notice, setNotice] = useState("");

  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const countriesQuery = useQuery({
    queryKey: destinationKeys.countries,
    queryFn: DestinationsApi.countries,
  });
  const countries = countriesQuery.data ?? [];
  const selectedCountry =
    countries.find((item) => item.code === country) ??
    (countries.length === 1 ? countries[0] : undefined);

  const hasDates = !!from && !!to && to > from && from >= todayIso();
  const noDates = !from && !to;
  const canSearch = !!selectedCountry && (noDates || hasDates);

  const actionLabel = !selectedCountry
    ? "Choose a country"
    : !noDates && !hasDates
      ? !from
        ? "Choose pickup date"
        : "Choose return date"
      : noDates
        ? "Browse cars"
        : "Check availability";
  function closeDates() {
    setEditing(null);
    document.getElementById(`hero-${editing}`)?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    const sp = filtersToSearchParams({
      country: selectedCountry?.code,
      region: region || undefined,
      from: from || undefined,
      to: to || undefined,
      category,
    });
    const qs = sp.toString();
    router.push(
      `/cars/${encodeURIComponent(city || "all")}${qs ? `?${qs}` : ""}`,
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-lg md:p-6"
    >
      {/* Both previews stack on phones; desktop A keeps a compact action inline. */}
      <div
        className={cn(
          "grid grid-cols-1 items-end gap-4 sm:grid-cols-2",
          layout === "A"
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
            : "lg:grid-cols-4",
        )}
      >
        <DestinationFields
          country={selectedCountry?.code ?? ""}
          region={region}
          city={city}
          onCityChange={setCity}
          onCountryChange={(code) => {
            setCountry(code);
            setRegion("");
            setCity("");
          }}
          onRegionChange={(slug) => {
            setRegion(slug);
            setCity("");
          }}
        />
        <div className="min-w-0 space-y-1.5">
          <Label id="hero-dates-label">
            Dates{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </Label>
          <div
            role="group"
            aria-labelledby="hero-dates-label"
            className="flex h-10 rounded-[var(--radius-sm)] border border-border bg-surface"
          >
            {(["from", "to"] as const).map((endpoint) => {
              const date = endpoint === "from" ? from : to;
              const label = endpoint === "from" ? "Pickup" : "Return";
              return (
                <button
                  key={endpoint}
                  id={`hero-${endpoint}`}
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 last:border-l last:border-border"
                  aria-label={`${label}: ${date ? displayDate(date) : "Any date"}`}
                  aria-expanded={editing === endpoint}
                  aria-controls="hero-calendar"
                  onClick={() =>
                    setEditing((current) =>
                      current === endpoint ? null : endpoint,
                    )
                  }
                >
                  <CalendarDays
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="truncate">
                    {date ? displayDate(date) : label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <Button
          type="submit"
          disabled={!canSearch}
          className={cn(
            "h-10 w-full",
            layout === "B"
              ? "col-span-full"
              : "sm:col-span-2 lg:col-span-1 lg:px-3",
          )}
          aria-label={actionLabel}
        >
          <Search className="h-4 w-4 shrink-0" />
          {actionLabel}
        </Button>
      </div>
      <p
        role="status"
        className={notice ? "mt-2 text-sm text-muted-foreground" : "sr-only"}
      >
        {notice}
      </p>
      {editing ? (
        <div
          id="hero-calendar"
          className="mt-4 max-w-sm"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDates();
          }}
        >
          <DateRangePicker
            key={editing}
            editing={editing}
            value={{ from, to }}
            minDate={todayIso()}
            locale="en-GB"
            showAvailabilityLegend={false}
            isDayBlocked={() => false}
            onChange={(range) => {
              setNotice(
                to && !range.to
                  ? "Pickup updated. Choose a new return date after pickup."
                  : "",
              );
              setFrom(range.from);
              setTo(range.to);
              closeDates();
            }}
          />
          <div className="mt-2 flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setNotice("");
                setFrom("");
                setTo("");
                closeDates();
              }}
            >
              Any dates
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeDates}
            >
              Close
            </Button>
          </div>
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

/** Day/month display only; URLs and the API retain ISO dates. */
function displayDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
