import { Api } from "@/shared/api/client";
import type { City, Country, Region } from "@/shared/types/domain";

export const destinationKeys = {
  countries: ["geo", "countries"] as const,
  regions: (country: string) => ["geo", "regions", country] as const,
  scopedCities: (country: string, region?: string) =>
    ["geo", "cities", country, region ?? ""] as const,
  cities: ["geo", "cities"] as const,
};
export const DestinationsApi = {
  async countries(): Promise<Country[]> {
    return (await Api.get<Country[]>("/geo/countries")).data;
  },
  async regions(country: string): Promise<Region[]> {
    return (await Api.get<Region[]>("/geo/regions", { params: { country } }))
      .data;
  },
  async cities(country?: string, region?: string): Promise<City[]> {
    return (
      await Api.get<City[]>("/geo/cities", { params: { country, region } })
    ).data;
  },
};

// Search sends country, so only collisions within that country are ambiguous.
export function hasUniqueCitySlug(city: City, cities: City[]): boolean {
  return (
    cities.filter(
      (candidate) =>
        candidate.slug === city.slug && candidate.countryId === city.countryId,
    ).length === 1
  );
}
