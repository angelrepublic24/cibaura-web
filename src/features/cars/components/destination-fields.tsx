"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DestinationsApi,
  destinationKeys,
  hasUniqueCitySlug,
} from "../destinations";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

export function DestinationFields({
  country,
  region,
  city,
  onCountryChange,
  onRegionChange,
  onCityChange,
}: {
  country: string;
  region: string;
  city: string;
  onCountryChange: (code: string) => void;
  onRegionChange: (slug: string) => void;
  onCityChange: (slug: string) => void;
}) {
  const countriesQuery = useQuery({
    queryKey: destinationKeys.countries,
    queryFn: DestinationsApi.countries,
  });
  const citiesQuery = useQuery({
    queryKey: destinationKeys.cities,
    queryFn: () => DestinationsApi.cities(),
  });
  const countries = countriesQuery.data ?? [];
  const cities = citiesQuery.data ?? [];
  const selectedCountry = countries.find((item) => item.code === country);
  const regionsQuery = useQuery({
    queryKey: destinationKeys.regions(country),
    queryFn: () => DestinationsApi.regions(country),
    enabled: !!country,
  });
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
        <Label htmlFor="hero-country">Destination country</Label>
        {countries.length === 1 ? (
          <Input
            id="hero-country"
            readOnly
            value={countries[0]?.name ?? ""}
            aria-label="Destination country (currently the only destination country)"
          />
        ) : (
          <Select
            id="hero-country"
            value={selectedCountry?.code ?? ""}
            disabled={countriesQuery.isPending || failed}
            onChange={(event) => {
              onCountryChange(event.target.value);
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
        <Label htmlFor="hero-region">{regionLabel}</Label>
        <Select
          id="hero-region"
          value={region}
          disabled={!country || regionsQuery.isPending || regionsQuery.isError}
          onChange={(event) => onRegionChange(event.target.value)}
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
        <Label htmlFor="hero-city">City</Label>
        <Select
          id="hero-city"
          value={city}
          disabled={!selectedCountry || citiesQuery.isPending || failed}
          onChange={(event) => {
            onCityChange(event.target.value);
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
              {hasUniqueCitySlug(item, cities)
                ? ""
                : " — currently unavailable"}
            </option>
          ))}
        </Select>
      </div>
      {regionsQuery.isError ? (
        <p role="alert" className="col-span-full text-sm">
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
        <p role="alert" className="col-span-full text-sm">
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
        <p className="col-span-full text-sm">No destinations are listed yet.</p>
      ) : null}
      {selectedCountry &&
      !citiesQuery.isPending &&
      !failed &&
      countryCities.length === 0 ? (
        <p className="col-span-full text-sm">
          No cities are listed for this selection. You can still browse without
          choosing a city.
        </p>
      ) : null}
    </>
  );
}
