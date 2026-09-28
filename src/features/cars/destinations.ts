import { Api } from "@/shared/api/client";
import type { City, Country } from "@/shared/types/domain";

export const destinationKeys = {
  countries: ["geo", "countries"] as const,
  cities: ["geo", "cities"] as const,
};
export const DestinationsApi = {
  async countries(): Promise<Country[]> {
    return (await Api.get<Country[]>("/geo/countries")).data;
  },
  async cities(): Promise<City[]> {
    return (await Api.get<City[]>("/geo/cities")).data;
  },
};

// Current catalog resolves a slug globally, while geo permits country-local slugs.
// Never send an ambiguous destination to that endpoint.
export function hasUniqueCitySlug(city: City, cities: City[]): boolean {
  return (
    cities.filter((candidate) => candidate.slug === city.slug).length === 1
  );
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export function matchDestination(
  results: Pick<google.maps.GeocoderResult, "address_components">[],
  countries: Country[],
  cities: City[],
): { country: Country; city: City } | null {
  for (const result of results) {
    const code = result.address_components.find((part) =>
      part.types.includes("country"),
    )?.short_name;
    const country = countries.find(
      (item) => item.code.toUpperCase() === code?.toUpperCase(),
    );
    if (!country) continue;
    const names = result.address_components
      .filter(
        (part) =>
          part.types.includes("locality") || part.types.includes("postal_town"),
      )
      .map((part) => normalize(part.long_name));
    const matches = cities.filter(
      (city) =>
        city.countryId === country.id &&
        names.some(
          (name) =>
            name === normalize(city.name) || name === normalize(city.slug),
        ),
    );
    const city = matches[0];
    if (matches.length === 1 && city && hasUniqueCitySlug(city, cities))
      return { country, city };
  }
  return null;
}
