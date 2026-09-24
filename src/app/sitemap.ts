import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import type { AgencyPublicProfile } from "@/features/agencies/api";
import type { Car, City } from "@/shared/types/domain";
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
      for (const city of cities)
        paths.add(`/cars/${encodeURIComponent(city.slug)}`);
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
  ["public-sitemap-v2", API_URL],
  { revalidate: 300 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // CI has no live API. Cache both complete and degraded results for five minutes.
  await connection();
  return getSitemap();
}
