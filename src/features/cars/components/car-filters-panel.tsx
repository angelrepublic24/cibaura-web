"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
 * Faceted filters for the results page. Local draft state, committed to
 * the URL via `onApply` — the parent owns navigation, this panel never
 * talks to the router directly.
 *
 * Make -> model are DEPENDENT selects driven by the seeded catalog
 * (agencies can only list catalog cars, so facets stay clean).
 */
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

  return (
    <form
      className="space-y-4 rounded-[var(--radius)] border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-24"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <h2 className="text-base font-semibold text-foreground">Filters</h2>

      <div className="space-y-1.5">
        <Label htmlFor="f-make">Make</Label>
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
            {makesQuery.isError ? "Catalog unavailable" : "Any make"}
          </option>
          {(makesQuery.data ?? []).map((m) => (
            <option key={m.id} value={m.slug}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-model">Model</Label>
        <Select
          id="f-model"
          value={draft.model ?? ""}
          disabled={!selectedMake || modelsQuery.isLoading}
          onChange={(e) => set("model", e.target.value || undefined)}
        >
          <option value="">
            {selectedMake ? "Any model" : "Pick a make first"}
          </option>
          {(modelsQuery.data ?? []).map((m) => (
            <option key={m.id} value={m.slug}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="f-year-min">Year from</Label>
          <Input
            id="f-year-min"
            type="number"
            inputMode="numeric"
            placeholder="2018"
            value={draft.yearMin ?? ""}
            onChange={(e) =>
              set("yearMin", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-year-max">Year to</Label>
          <Input
            id="f-year-max"
            type="number"
            inputMode="numeric"
            placeholder="2026"
            value={draft.yearMax ?? ""}
            onChange={(e) =>
              set("yearMax", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-color">Color</Label>
        <Select
          id="f-color"
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-category">Category</Label>
        <Select
          id="f-category"
          value={draft.category ?? ""}
          onChange={(e) => set("category", e.target.value || undefined)}
        >
          <option value="">Any category</option>
          {CAR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-transmission">Transmission</Label>
        <Select
          id="f-transmission"
          value={draft.transmission ?? ""}
          onChange={(e) => set("transmission", e.target.value || undefined)}
        >
          <option value="">Any</option>
          {TRANSMISSIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="f-price-min">Price/day min</Label>
          <Input
            id="f-price-min"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={draft.priceMin ?? ""}
            onChange={(e) =>
              set(
                "priceMin",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-price-max">Price/day max</Label>
          <Input
            id="f-price-max"
            type="number"
            inputMode="numeric"
            placeholder="200"
            value={draft.priceMax ?? ""}
            onChange={(e) =>
              set(
                "priceMax",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1">
          Apply
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onApply({ from: draft.from, to: draft.to })}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
