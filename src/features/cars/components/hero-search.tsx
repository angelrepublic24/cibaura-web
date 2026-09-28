"use client";

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
export function HeroSearch() {
  const router = useRouter();
  const [datesOpen, setDatesOpen] = useState(false);
  const [city, setCity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  const hasDates = !!from && !!to && to > from && from >= todayIso();
  const noDates = !from && !to;
  const canSearch = !!city && (noDates || hasDates);

  const actionLabel = !city
    ? "Choose a city"
    : !noDates && !hasDates
      ? "Choose return date"
      : noDates
        ? "Browse cars"
        : "Check availability";
  const dateLabel = from
    ? `${displayDate(from)} - ${to ? displayDate(to) : "Return date"}`
    : "Any dates";
  function closeDates() {
    setDatesOpen(false);
    document.getElementById("hero-dates")?.focus();
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
      {/* Direct grid children share control bottoms; auto-fit accommodates a future
          state field without fixed column counts or a mobile horizontal row. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] items-end gap-4">
        <DestinationFields city={city} onCityChange={setCity} />
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="hero-dates">
            Dates{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </Label>
          <Button
            id="hero-dates"
            type="button"
            variant="outline"
            className="h-10 w-full justify-start px-3 text-sm"
            aria-expanded={datesOpen}
            aria-controls="hero-calendar"
            onClick={() => setDatesOpen((open) => !open)}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">{dateLabel}</span>
          </Button>
        </div>
        <Button
          type="submit"
          disabled={!canSearch}
          className="h-10 w-full"
          aria-label={actionLabel}
        >
          <Search className="h-4 w-4" />
          {actionLabel}
        </Button>
      </div>
      {datesOpen ? (
        <div
          id="hero-calendar"
          className="mt-4 max-w-sm"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDates();
          }}
        >
          <DateRangePicker
            value={{ from, to }}
            minDate={todayIso()}
            locale="en-GB"
            showAvailabilityLegend={false}
            isDayBlocked={() => false}
            onChange={(range) => {
              setFrom(range.from);
              setTo(range.to);
              if (range.from && range.to) closeDates();
            }}
          />
          <div className="mt-2 flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
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
