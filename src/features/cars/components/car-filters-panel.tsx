"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { CatalogApi, catalogKeys } from "@/features/catalog/api";
import type { CarSearchFilters } from "@/features/cars/filters";
import {
  CAR_CATEGORIES,
  CAR_COLORS,
  TRANSMISSIONS,
} from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * Faceted filters for the results page — a clean, vertical, Carguros-style
 * panel. Make → Model → Year are the primary, full-width cascading facets
 * (pick a make and the model list fills), then quiet secondary facets.
 *
 * Local draft state, committed to the URL via `onApply` — the parent owns
 * navigation, this panel never talks to the router directly.
 */

const CURRENT_YEAR = new Date().getFullYear();
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

  const makesQuery = useQuery({
    queryKey: catalogKeys.makes(),
    queryFn: CatalogApi.listMakes,
  });

  const selectedMake = (makesQuery.data ?? []).find(
    (m) => m.slug === draft.make,
  );

  const modelsQuery = useQuery({
    queryKey: catalogKeys.models(selectedMake?.id ?? ""),
    queryFn: () => CatalogApi.listModels(selectedMake!.id),
    enabled: !!selectedMake,
  });

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
    ];
    return keys.filter((k) => draft[k] !== undefined && draft[k] !== "").length;
  }, [draft]);

  return (
    <form
      className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]"
      onSubmit={(e) => {
        e.preventDefault();
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
            onClick={() => onApply({ from: draft.from, to: draft.to })}
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
                value={draft.priceMax ?? ""}
                onChange={(e) =>
                  set("priceMax", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Action bar — always visible at the panel's foot, never scrolls away. */}
      <div className="shrink-0 border-t border-border bg-surface p-4">
        <Button type="submit" className="w-full">
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
