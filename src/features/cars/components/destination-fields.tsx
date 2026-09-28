"use client";

import { useState } from "react";
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
  city,
  onCityChange,
}: {
  city: string;
  onCityChange: (slug: string) => void;
}) {
  const countriesQuery = useQuery({
    queryKey: destinationKeys.countries,
    queryFn: DestinationsApi.countries,
  });
  const citiesQuery = useQuery({
    queryKey: destinationKeys.cities,
    queryFn: DestinationsApi.cities,
  });
  const countries = countriesQuery.data ?? [];
  const cities = citiesQuery.data ?? [];
  const [countryId, setCountryId] = useState("");
  const selectedCountry =
    countries.find((country) => country.id === countryId) ??
    (countries.length === 1 ? countries[0] : undefined);
  const countryCities = cities.filter(
    (item) => item.countryId === selectedCountry?.id,
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
            value={selectedCountry?.id ?? ""}
            disabled={countriesQuery.isPending || failed}
            onChange={(event) => {
              setCountryId(event.target.value);
              onCityChange("");
            }}
          >
            <option value="">
              {countriesQuery.isPending
                ? "Loading countries…"
                : "Choose a country"}
            </option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
        )}
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
            {citiesQuery.isPending ? "Loading cities…" : "Choose a city"}
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
          No cities are listed in this country yet. Choose another destination.
        </p>
      ) : null}
    </>
  );
}
