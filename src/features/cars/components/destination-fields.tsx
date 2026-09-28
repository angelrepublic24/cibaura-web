"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DestinationsApi,
  destinationKeys,
  hasUniqueCitySlug,
  matchDestination,
} from "../destinations";
import type { City, Country } from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
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
  const [suggestion, setSuggestion] = useState<{
    country: Country;
    city: City;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  function discardSuggestion() {
    request.current++;
    setLocating(false);
    setSuggestion(null);
    setMessage("");
  }

  async function locate() {
    const current = ++request.current;
    setSuggestion(null);
    setMessage("");
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !navigator.geolocation) {
      setMessage(
        "Location suggestions are unavailable. Choose your destination manually.",
      );
      return;
    }
    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            maximumAge: 60000,
            enableHighAccuracy: false,
          }),
      );
      if (current !== request.current) return;
      const { loadGoogleMaps } = await import("@/shared/hooks/use-google-maps");
      await loadGoogleMaps(key);
      const { Geocoder } = (await google.maps.importLibrary(
        "geocoding",
      )) as google.maps.GeocodingLibrary;
      const response = await new Geocoder().geocode({
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
      });
      if (current !== request.current) return;
      const found = matchDestination(response.results, countries, cities);
      setSuggestion(found);
      if (!found)
        setMessage(
          "We could not match your location to a supported destination. Choose a country and city manually.",
        );
    } catch {
      if (current === request.current)
        setMessage(
          "We could not use your location. You can still choose any destination manually.",
        );
    } finally {
      if (current === request.current) setLocating(false);
    }
  }

  const failed = countriesQuery.isError || citiesQuery.isError;
  return (
    <div className="space-y-3 md:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hero-country">Destination country</Label>
          {countries.length === 1 ? (
            <input
              id="hero-country"
              readOnly
              value={countries[0]?.name ?? ""}
              className="h-10 w-full rounded-[var(--radius-sm)] border border-border bg-muted px-3 text-sm"
            />
          ) : (
            <Select
              id="hero-country"
              value={selectedCountry?.id ?? ""}
              disabled={countriesQuery.isPending || failed}
              onChange={(event) => {
                discardSuggestion();
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
        <div className="space-y-1.5">
          <Label htmlFor="hero-city">City</Label>
          <Select
            id="hero-city"
            value={city}
            disabled={!selectedCountry || citiesQuery.isPending || failed}
            onChange={(event) => {
              discardSuggestion();
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
      </div>
      {failed ? (
        <p role="alert" className="text-sm">
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
        <p className="text-sm">No destinations are listed yet.</p>
      ) : null}
      {selectedCountry &&
      !citiesQuery.isPending &&
      !failed &&
      countryCities.length === 0 ? (
        <p className="text-sm">
          No cities are listed in this country yet. Choose another destination.
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={locating || failed || !countries.length || !cities.length}
        onClick={() => void locate()}
      >
        {locating ? "Finding a suggestion…" : "Use my location"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Optional: share your location with Google Maps to suggest a city. You
        choose whether to use it.
      </p>
      <div aria-live="polite">
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
        {suggestion ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-border p-3 text-sm">
            <p>
              Suggested destination: {suggestion.city.name},{" "}
              {suggestion.country.name}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setCountryId(suggestion.country.id);
                onCityChange(suggestion.city.slug);
                discardSuggestion();
              }}
            >
              Use this destination
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discardSuggestion}
            >
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
