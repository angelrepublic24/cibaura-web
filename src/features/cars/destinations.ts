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
