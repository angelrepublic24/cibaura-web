"use client";

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
  const selectedCountry = countries.find((item) => item.code === country);
  const regionsQuery = useRegions(country, !!country);
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
          disabled={!country || regionsQuery.isPending || regionsQuery.isError}
          onChange={(event) => {
            if (onDestinationChange)
              onDestinationChange({
                country,
                region: event.target.value,
                city: "",
              });
            else onRegionChange?.(event.target.value);
          }}
        >
          <option value="">
            {country && regionsQuery.isPending ? "Loading regions..." : "All"}
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
                country,
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
