import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { API_URL } from "@/lib/config";
import type { AgencyPublicProfile } from "@/features/agencies/api";
import type {
  Car,
  CarDetail,
  City,
  Country,
  Region,
  Paginated,
} from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";

/** Public GETs only: never forward session cookies or use the browser interceptors. */
export async function publicGet<T>(
  path: string,
  revalidate = 300,
): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`, {
    next: { revalidate },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public API ${response.status}: ${path}`);
  const data: T = await response.json();
  return data;
}

export const getPublicCar = cache(async (id: string) => {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const car = await publicGet<CarDetail>(`/cars/${encodeURIComponent(id)}`);
  // Backend CarStatus is draft | active | paused (no maintenance state).
  // Paused listings retain their public URL; only drafts were never published.
  if (!car || car.status === "draft") notFound();
  // Detail currently checks agency KYC only. The public profile lists active
  // branches, so do not index vehicles hidden from the availability search.
  const agency = await getPublicAgency(car.agency.slug);
  if (!agency.branches.some((branch) => branch.id === car.branchId)) notFound();
  return car;
});

export const getPublicAgency = cache(async (slug: string) => {
  const agency = await publicGet<AgencyPublicProfile>(
    `/agencies/${encodeURIComponent(slug)}`,
  );
  if (!agency || agency.verificationStatus !== "verified") notFound();
  return agency;
});

export const getPublicCity = cache(
  async (slug: string, country?: string, region?: string) => {
    const basePath = `/cars/${encodeURIComponent(slug)}`;
    let countryData: Country | undefined;
    let regionData: Region | undefined;
    if (country) {
      const countries = await publicGet<Country[]>("/geo/countries");
      countryData = countries?.find(
        (item) => item.code.toUpperCase() === country.toUpperCase(),
      );
      if (!countryData) notFound();
    }
    if (region) {
      if (!countryData) notFound();
      const regions = await publicGet<Region[]>(
        `/geo/regions?country=${encodeURIComponent(countryData.code)}`,
      );
      regionData = regions?.find((item) => item.slug === region);
      if (!regionData) notFound();
    }
    if (slug === "all") {
      const params = new URLSearchParams();
      if (countryData) params.set("country", countryData.code);
      if (regionData) params.set("region", regionData.slug);
      return {
        slug,
        name: regionData
          ? `${regionData.name}, ${countryData?.name}`
          : (countryData?.name ?? "All destinations"),
        path: basePath + (params.size ? `?${params}` : ""),
      };
    }
    const cities = await publicGet<City[]>("/geo/cities");
    if (!cities) throw new Error("Public city catalog unavailable");
    const matches = cities.filter(
      (item) =>
        item.slug === slug &&
        (!countryData || item.countryId === countryData.id) &&
        (!regionData || item.regionId === regionData.id),
    );
    if (matches.length !== 1) notFound();
    const city = matches[0];
    if (!city) notFound();
    // Existing unique-city URLs remain canonical. Country disambiguates collisions.
    const ambiguous = cities.filter((item) => item.slug === slug).length > 1;
    return {
      ...city,
      path:
        basePath +
        (ambiguous && countryData
          ? `?country=${encodeURIComponent(countryData.code)}`
          : ""),
    };
  },
);

/** Visit each successful page before continuing, so callers can retain partial progress. */
export async function allPublicPages<T>(
  path: string,
  onPage?: (items: T[]) => void | Promise<void>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await publicGet<Paginated<T>>(
      `${path}${separator}page=${page}`,
    );
    if (
      !result ||
      result.page !== page ||
      !Number.isInteger(result.pageSize) ||
      result.pageSize < 1 ||
      !Array.isArray(result.items) ||
      !Number.isInteger(result.total) ||
      result.total < 0
    ) {
      throw new Error(`Invalid public pagination: ${path}`);
    }
    items.push(...result.items);
    await onPage?.(result.items);
    if (page * result.pageSize >= result.total) return items;
    if (result.items.length === 0)
      throw new Error(`Incomplete public pagination: ${path}`);
  }
}

export function carPath(car: Pick<Car, "id" | "agency">): string {
  return `/agencies/${encodeURIComponent(car.agency.slug)}/cars/${encodeURIComponent(car.id)}`;
}

export function carTitle(car: Pick<Car, "year" | "make" | "model">): string {
  return `${car.year} ${car.make.name} ${car.model.name}`;
}

export function carDescription(car: CarDetail): string {
  return `Rent the ${carTitle(car)} from ${car.agency.name} in ${car.branch.city.name}, Dominican Republic. Base rate ${formatMoneyCents(car.pricePerDayCents)} per day; fees calculated at booking. View photos and rental conditions.`;
}
