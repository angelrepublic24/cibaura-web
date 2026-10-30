"use client";

import { useEffect } from "react";
import {
  useCities,
  useCountries,
  useRegions,
} from "@/modules/catalog/hooks/catalog.hook";
import { hasUniqueCitySlug } from "@/modules/cars/helpers/cars.helper";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

export type Destination = { country: string; region: string; city: string };

export function DestinationFields({
  country,
  region,
  city,
  onCountryChange,
  onRegionChange,
  onCityChange,
  onDestinationChange,
  idPrefix = "hero",
  showCityRegions = false,
}: {
  country: string;
  region: string;
  city: string;
  onDestinationChange?: (destination: Destination) => void;
  idPrefix?: string;
  showCityRegions?: boolean;
  onCountryChange?: (code: string) => void;
  onRegionChange?: (slug: string) => void;
  onCityChange?: (slug: string) => void;
}) {
  const countriesQuery = useCountries();
  const citiesQuery = useCities();
  const countries = countriesQuery.data ?? [];
  const cities = citiesQuery.data ?? [];

  /*
   * ONE COUNTRY IS A SELECTION, NOT A CAPTION (BUG-008).
   *
   * While the platform serves a single market the country field is a readOnly
   * box with its name in it — but the SELECTION still has to exist, because
   * the region and city fields are gated on it and the submitted URL carries
   * it. Resolving it was left to each parent: the hero did it, the results bar
   * did not, so `/cars/all` printed "Dominican Republic" above two disabled
   * dropdowns AND an Apply button stuck on "Choose a country" — with no
   * control anywhere on screen that could choose the country already being
   * displayed. Resolved here instead, so the two parents cannot drift again.
   */
  const onlyCountry = countries.length === 1 ? countries[0] : undefined;
  const effectiveCountry = country || onlyCountry?.code || "";
  const selectedCountry = countries.find(
    (item) => item.code === effectiveCountry,
  );
  const regionsQuery = useRegions(effectiveCountry, !!effectiveCountry);
  const regions = regionsQuery.data ?? [];
  const selectedRegion = regions.find((item) => item.slug === region);
  const kinds = [...new Set(regions.map((item) => item.kind))];
  const kind =
    selectedRegion?.kind || (kinds.length === 1 ? kinds[0] : "region");
  const regionLabel = kind
    ? kind.charAt(0).toUpperCase() + kind.slice(1).replaceAll("_", " ")
    : "Region";
  const countryCities = cities.filter(
    (item) =>
      item.countryId === selectedCountry?.id &&
      (!region || item.regionId === selectedRegion?.id),
  );
  const failed = countriesQuery.isError || citiesQuery.isError;

  /*
   * Hand the resolved country UP, so what the parent submits matches what the
   * fields are showing — a search run from `/cars/all` has to carry
   * `country=DO` like any other. It ADDS the country and leaves region and
   * city alone: this is not the user changing country (which does clear
   * both), it is the form catching up with what it already displayed. The
   * guard is false the moment the parent stores it, so this settles in one
   * pass whether or not the callback identity is stable.
   */
  useEffect(() => {
    if (country || !onlyCountry) return;
    if (onDestinationChange) {
      onDestinationChange({ country: onlyCountry.code, region, city });
    } else {
      onCountryChange?.(onlyCountry.code);
    }
  }, [
    country,
    onlyCountry,
    region,
    city,
    onDestinationChange,
    onCountryChange,
  ]);
  return (
    <>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${idPrefix}-country`}>Destination country</Label>
        {countries.length === 1 ? (
          <Input
            id={`${idPrefix}-country`}
            readOnly
            value={countries[0]?.name ?? ""}
            aria-label="Destination country (currently the only destination country)"
          />
        ) : (
          <Select
            id={`${idPrefix}-country`}
            value={selectedCountry?.code ?? ""}
            disabled={countriesQuery.isPending || failed}
            onChange={(event) => {
              if (onDestinationChange)
                onDestinationChange({
                  country: event.target.value,
                  region: "",
                  city: "",
                });
              else onCountryChange?.(event.target.value);
            }}
          >
            <option value="">
              {countriesQuery.isPending
                ? "Loading countries…"
                : "Choose a country"}
            </option>
            {countries.map((country) => (
              <option key={country.id} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${idPrefix}-region`}>{regionLabel}</Label>
        <Select
          id={`${idPrefix}-region`}
          value={region}
          disabled={
            !effectiveCountry || regionsQuery.isPending || regionsQuery.isError
          }
          onChange={(event) => {
            if (onDestinationChange)
              onDestinationChange({
                country: effectiveCountry,
                region: event.target.value,
                city: "",
              });
            else onRegionChange?.(event.target.value);
          }}
        >
          <option value="">
            {effectiveCountry && regionsQuery.isPending
              ? "Loading regions..."
              : "All"}
          </option>
          {regions.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${idPrefix}-city`}>City</Label>
        <Select
          id={`${idPrefix}-city`}
          value={city}
          disabled={!selectedCountry || citiesQuery.isPending || failed}
          onChange={(event) => {
            if (onDestinationChange)
              onDestinationChange({
                country: effectiveCountry,
                region,
                city: event.target.value,
              });
            else onCityChange?.(event.target.value);
          }}
        >
          <option value="">
            {citiesQuery.isPending ? "Loading cities…" : "All cities"}
          </option>
          {countryCities.map((item) => (
            <option
              key={item.id}
              value={item.slug}
              disabled={!hasUniqueCitySlug(item, cities)}
            >
              {item.name}
              {showCityRegions &&
              !region &&
              item.regionId &&
              regions.find((entry) => entry.id === item.regionId)
                ? `, ${regions.find((entry) => entry.id === item.regionId)?.name}`
                : ""}
              {hasUniqueCitySlug(item, cities)
                ? ""
                : " — currently unavailable"}
            </option>
          ))}
        </Select>
      </div>
      {/* `order-last` on every one of these notices, and it is load-bearing.
          They are direct children of the search GRID and sit between the city
          field and the dates field in DOM order, so a `col-span-full` notice
          opens a full row right there and shoves the dates and the action
          button onto the row below — the layout jumps the moment any query
          blips. Visual order moves; DOM order stays, which is where a screen
          reader wants the alert: next to the fields it is about. */}
      {regionsQuery.isError ? (
        <p role="alert" className="order-last col-span-full text-sm">
          Regions could not be loaded. You can still browse the country.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void regionsQuery.refetch()}
          >
            Try again
          </button>
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="order-last col-span-full text-sm">
          Destinations could not be loaded.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void countriesQuery.refetch();
              void citiesQuery.refetch();
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
      {!countriesQuery.isPending && !failed && countries.length === 0 ? (
        <p className="order-last col-span-full text-sm">
          No destinations are listed yet.
        </p>
      ) : null}
      {selectedCountry &&
      !citiesQuery.isPending &&
      !failed &&
      countryCities.length === 0 ? (
        <p className="order-last col-span-full text-sm">
          No cities are listed for this selection. You can still browse without
          choosing a city.
        </p>
      ) : null}
    </>
  );
}
