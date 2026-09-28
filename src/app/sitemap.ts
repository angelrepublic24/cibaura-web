import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import type { AgencyPublicProfile } from "@/features/agencies/api";
import type { Car, City, Country } from "@/shared/types/domain";
import { API_URL } from "@/lib/config";
import { absoluteUrl } from "@/shared/seo/metadata";
import { allPublicPages, carPath, publicGet } from "@/shared/seo/public-api";

const getSitemap = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const paths = new Set([
      "/",
      "/agencies",
      "/cars/all",
      "/become-host",
      "/become-agency",
      "/legal/terms",
      "/legal/privacy",
    ]);
    try {
      const cities = await publicGet<City[]>("/agencies/available-cities");
      if (!cities) throw new Error("Available cities endpoint unavailable");
      const catalog = await publicGet<City[]>("/geo/cities");
      if (!catalog) throw new Error("City catalog unavailable");
      const collisions = new Set(
        catalog
          .filter((city) =>
            catalog.some(
              (other) => other.id !== city.id && other.slug === city.slug,
            ),
          )
          .map((city) => city.slug),
      );
      const countries = collisions.size
        ? await publicGet<Country[]>("/geo/countries")
        : [];
      for (const city of cities) {
        const path = `/cars/${encodeURIComponent(city.slug)}`;
        if (!collisions.has(city.slug)) paths.add(path);
        else {
          const country = countries?.find((item) => item.id === city.countryId);
          if (country)
            paths.add(`${path}?country=${encodeURIComponent(country.code)}`);
        }
      }
      await allPublicPages<AgencyPublicProfile>(
        "/agencies?sort=name",
        async (agencies) => {
          for (const agency of agencies) {
            if (agency.verificationStatus !== "verified") continue;
            const agencyPath = `/agencies/${encodeURIComponent(agency.slug)}`;
            const profile = await publicGet<AgencyPublicProfile>(
              `/agencies/${encodeURIComponent(agency.slug)}`,
            );
            // An agency may be unpublished while enumeration is running.
            if (!profile || profile.verificationStatus !== "verified") continue;
            paths.add(agencyPath);
            // Catalog AND detail currently omit the active-branch gate. Public profile
            // exposes only active branches, without private addresses or coordinates.
            const activeBranches = new Set(
              profile.branches.map((branch) => branch.id),
            );
            await allPublicPages<Car>(
              `/agencies/${encodeURIComponent(agency.slug)}/cars?pageSize=100`,
              (cars) => {
                for (const car of cars) {
                  if (
                    car.status === "active" &&
                    car.agency.id === profile.id &&
                    activeBranches.has(car.branchId)
                  ) {
                    paths.add(carPath(car));
                  }
                }
              },
            );
          }
        },
      );
    } catch (error) {
      // Cache the partial result too. Stop on the first failure (including 429),
      // keeping successful pages and static URLs without retrying the remaining API.
      console.warn(`Sitemap degraded to ${paths.size} known URLs`, error);
    }
    // Keep the degraded sitemap valid even at the format's hard limit.
    // Split into sitemap files before the public inventory reaches this size.
    if (paths.size > 50_000)
      console.warn("Sitemap capped at 50,000 URLs; partition the inventory.");
    return [...paths]
      .slice(0, 50_000)
      .map((path) => ({ url: absoluteUrl(path) }));
  },
  ["public-sitemap-v3", API_URL],
  { revalidate: 300 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // CI has no live API. Cache both complete and degraded results for five minutes.
  await connection();
  return getSitemap();
}
