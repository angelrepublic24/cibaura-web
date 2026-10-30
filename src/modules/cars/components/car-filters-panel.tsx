"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { businessTodayIso } from "@/shared/utils/dates";
import {
  useCarMakes,
  useCarModels,
} from "@/modules/catalog/hooks/catalog.hook";
import type { CarSearchFilters } from "@/modules/cars/types/cars.types";
import {
  CAR_CATEGORIES,
  CAR_COLORS,
  TRANSMISSIONS,
} from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { RATING_MINIMUMS } from "@/modules/cars/helpers/cars.helper";

/**
 * Faceted filters for the results page — a clean, vertical, Carguros-style
 * panel. Make → Model → Year are the primary, full-width cascading facets
 * (pick a make and the model list fills), then quiet secondary facets.
 *
 * Local draft state, committed to the URL via `onApply` — the parent owns
 * navigation, this panel never talks to the router directly.
 */

/*
 * THE YEAR LIST IS BUILT FROM THE BUSINESS CALENDAR, NOT THE RUNTIME'S CLOCK
 * (BUG-009).
 *
 * This is a `"use client"` module, so module scope is evaluated TWICE — once
 * in the server bundle while the page is pre-rendered, once in the browser —
 * and `new Date().getFullYear()` reads each runtime's LOCAL year. A container
 * on UTC and a renter in UTC-4 disagree for four hours every 31 December, and
 * the disagreement lands in rendered `<option>` text, which is precisely the
 * hydration mismatch React reports as #418.
 *
 * `businessTodayIso()` pins the timezone on both sides (the same anchor the
 * backend uses for date-only gates), so the two runtimes build the same list.
 */
const CURRENT_YEAR = Number(businessTodayIso().slice(0, 4));
const YEARS = Array.from({ length: CURRENT_YEAR + 1 - 2005 + 1 }, (_, i) =>
  CURRENT_YEAR + 1 - i,
);

export function CarFiltersPanel({
  filters,
  onApply,
}: {
  filters: CarSearchFilters;
  onApply: (next: CarSearchFilters) => void;
}) {
  const [draft, setDraft] = useState<CarSearchFilters>(filters);

  // Re-sync the draft when the URL changes externally (back/forward).
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const makesQuery = useCarMakes();

  const selectedMake = (makesQuery.data ?? []).find(
    (m) => m.slug === draft.make,
  );

  const modelsQuery = useCarModels(selectedMake?.id);

  function set<K extends keyof CarSearchFilters>(
    key: K,
    value: CarSearchFilters[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Count active facets (dates are the search itself, not a facet).
  const activeCount = useMemo(() => {
    const keys: (keyof CarSearchFilters)[] = [
      "make",
      "model",
      "yearMin",
      "yearMax",
      "category",
      "transmission",
      "color",
      "priceMin",
      "priceMax",
      "ratingMin",
    ];
    return keys.filter((k) => draft[k] !== undefined && draft[k] !== "").length;
  }, [draft]);

  // Cross-field range guards: an inverted range (min > max) silently returns
  // zero results and dumps the renter on the generic empty state, so block
  // "Apply" and say why — the same shape as the admin revenue screen's check.
  const yearRangeInvalid =
    draft.yearMin !== undefined &&
    draft.yearMax !== undefined &&
    draft.yearMin > draft.yearMax;
  const priceRangeInvalid =
    draft.priceMin !== undefined &&
    draft.priceMax !== undefined &&
    draft.priceMin > draft.priceMax;
  const rangeInvalid = yearRangeInvalid || priceRangeInvalid;

  return (
    <form
      className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (rangeInvalid) return;
        onApply(draft);
      }}
    >
      {/* Header (stays put while the facets scroll inside the panel). */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          {activeCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </div>
        {activeCount > 0 ? (
          <button
            type="button"
            // Keeps the trip AND the chosen order: an order is not a
            // filter, and silently resetting it to cheapest-first after
            // "Clear all" is how a renter ends up reading a price-sorted
            // page while the menu still says "Best rated".
            onClick={() =>
              onApply({ from: draft.from, to: draft.to, sort: draft.sort })
            }
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="space-y-6 p-5 lg:min-h-0 lg:overflow-y-auto">
        {/* ── Vehicle (primary, cascading) ── */}
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vehicle
          </p>

          <Field label="Make" htmlFor="f-make">
            <Select
              id="f-make"
              value={draft.make ?? ""}
              disabled={makesQuery.isLoading || makesQuery.isError}
              onChange={(e) => {
                set("make", e.target.value || undefined);
                set("model", undefined); // model depends on make
              }}
            >
              <option value="">
                {makesQuery.isError ? "Catalog unavailable" : "All makes"}
              </option>
              {(makesQuery.data ?? []).map((m) => (
                <option key={m.id} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Model" htmlFor="f-model">
            <Select
              id="f-model"
              value={draft.model ?? ""}
              disabled={!selectedMake || modelsQuery.isLoading}
              onChange={(e) => set("model", e.target.value || undefined)}
            >
              <option value="">
                {!selectedMake
                  ? "Select a make first"
                  : modelsQuery.isLoading
                    ? "Loading models…"
                    : "All models"}
              </option>
              {(modelsQuery.data ?? []).map((m) => (
                <option key={m.id} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Year">
            <div className="grid grid-cols-2 gap-2">
              <Select
                aria-label="Year from"
                aria-invalid={yearRangeInvalid}
                value={draft.yearMin ?? ""}
                onChange={(e) =>
                  set("yearMin", e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">From</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Year to"
                aria-invalid={yearRangeInvalid}
                value={draft.yearMax ?? ""}
                onChange={(e) =>
                  set("yearMax", e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">To</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            {yearRangeInvalid ? (
              <p className="text-sm text-destructive">
                The &ldquo;from&rdquo; year can&apos;t be after the &ldquo;to&rdquo; year.
              </p>
            ) : null}
          </Field>
        </div>

        <div className="h-px bg-border" />

        {/* ── Specs ── */}
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Specs
          </p>

          <Field label="Body type" htmlFor="f-category">
            <Select
              id="f-category"
              className="capitalize"
              value={draft.category ?? ""}
              onChange={(e) => set("category", e.target.value || undefined)}
            >
              <option value="">All types</option>
              {CAR_CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Transmission" htmlFor="f-transmission">
            <Select
              id="f-transmission"
              className="capitalize"
              value={draft.transmission ?? ""}
              onChange={(e) => set("transmission", e.target.value || undefined)}
            >
              <option value="">Any</option>
              {TRANSMISSIONS.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Color" htmlFor="f-color">
            <Select
              id="f-color"
              className="capitalize"
              value={draft.color ?? ""}
              onChange={(e) => set("color", e.target.value || undefined)}
            >
              <option value="">Any color</option>
              {CAR_COLORS.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="h-px bg-border" />

        {/* ── Price / day ── */}
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Price per day
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min" htmlFor="f-price-min">
              <Input
                id="f-price-min"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="$0"
                aria-invalid={priceRangeInvalid}
                value={draft.priceMin ?? ""}
                onChange={(e) =>
                  set("priceMin", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </Field>
            <Field label="Max" htmlFor="f-price-max">
              <Input
                id="f-price-max"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="$200"
                aria-invalid={priceRangeInvalid}
                value={draft.priceMax ?? ""}
                onChange={(e) =>
                  set("priceMax", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </Field>
          </div>
          {priceRangeInvalid ? (
            <p className="text-sm text-destructive">
              The minimum price can&apos;t be above the maximum.
            </p>
          ) : null}
        </div>

        <div className="h-px bg-border" />

        {/* ── Host ── */}
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Host
          </p>

          <Field label="Minimum rating" htmlFor="f-rating-min">
            <Select
              id="f-rating-min"
              value={draft.ratingMin ?? ""}
              onChange={(e) =>
                set("ratingMin", e.target.value ? Number(e.target.value) : undefined)
              }
            >
              {RATING_MINIMUMS.map((r) => (
                <option key={r.label} value={r.value ?? ""}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>

          {/* Said up front, because an empty result is otherwise unexplained:
              a host with no reviews cannot satisfy "4 stars and up". */}
          {draft.ratingMin ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Hosts with no reviews yet are not shown while this is set.
            </p>
          ) : null}
        </div>
      </div>

      {/* Action bar — always visible at the panel's foot, never scrolls away. */}
      <div className="shrink-0 border-t border-border bg-surface p-4">
        <Button type="submit" className="w-full" disabled={rangeInvalid}>
          Apply filters
        </Button>
      </div>
    </form>
  );
}

/** Consistent label + control wrapper. */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
