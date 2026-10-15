import type { Metadata } from "next";
import { parseCarFilters } from "@/features/cars/filters";
import { CarSearchResults } from "@/features/cars/components/car-search-results";
import { pageMetadata } from "@/shared/seo/metadata";
import { BreadcrumbJsonLd } from "@/shared/seo/structured-data";
import { getPublicCity } from "@/shared/seo/public-api";
import Link from "next/link";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { carKeys } from "@/features/cars/api";
import {
  getCarSearch,
  getCarCatalog,
  getDirectory,
  prefetchCities,
  publicQueryClient,
} from "@/shared/seo/prefetch";

/**
 * /cars/[city] — search results. Filters live in the URL (shareable +
 * SEO). Availability is prefetched only with dates. Without dates, render
 * the published catalog and agency links without claiming availability.
 *
 * STATUS CODE — do not add a `loading.tsx` to this route, and do not move
 * these fetches below a `<Suspense>` boundary. Both flush a 200 shell before
 * the body finishes, and after that first byte the status can no longer
 * change: an unknown city would answer "200 and empty" (worse for search
 * than a clean 404) and an API outage would answer 200 with a blank page
 * instead of 500. Measured on a production build: with the fetches below a
 * boundary, a 503 from `/cars/catalog` returns 200 on every user agent, and
 * the real markup ships inside `<div hidden>` even for the HTML-limited bots
 * Next blocking-renders for (Bingbot, LinkedInBot, Slackbot,
 * facebookexternalhit). Awaiting here costs the route its route-transition
 * skeleton; `<CarSearchResults/>` still renders its own card skeletons for
 * every filter and page change, which is where the waiting actually happens.
 * `scripts/seo-smoke.mjs` asserts the status codes against a production
 * server so this cannot regress silently.
 */
type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { city } = await params;
  const filters = parseCarFilters(await searchParams);
  const { name, path } = await getPublicCity(
    city,
    filters.country,
    filters.region,
  );
  return pageMetadata({
    title: `Cars in ${name}`,
    description: `Search rental cars in ${name}. Choose your dates, compare local agencies and private hosts, and request a booking on Cibaura.`,
    path,
  });
}

export default async function CarsByCityPage({ params, searchParams }: Props) {
  const { city } = await params;
  const filters = parseCarFilters(await searchParams);
  const location = await getPublicCity(city, filters.country, filters.region);
  const client = publicQueryClient();
  const hasDates = !!filters.from && !!filters.to && filters.to > filters.from;
  const [, directory] = await Promise.all([
    Promise.all([
      prefetchCities(client),
      hasDates
        ? client.fetchQuery({
            queryKey: carKeys.search(city, filters),
            queryFn: () => getCarSearch(city, filters),
          })
        : client.fetchQuery({
            queryKey: carKeys.catalog(city, filters),
            queryFn: () => getCarCatalog(city, filters),
          }),
    ]),
    hasDates || filters.country
      ? Promise.resolve(null)
      : getDirectory({ city: city === "all" ? undefined : city }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          {
            name: location.name,
            path: location.path,
          },
        ]}
      />
      <HydrationBoundary state={dehydrate(client)}>
        <CarSearchResults
          city={city}
          cityName={location.name}
          filters={filters}
        />
      </HydrationBoundary>
      {!hasDates && (
        <section className="mt-10 space-y-4">
          <h2 className="font-display text-2xl">
            Rent a car in {location.name}
          </h2>
          <p className="text-muted-foreground">
            Explore local agencies and private hosts, compare their cars and
            rental conditions, then choose your dates to check availability and
            request a booking.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {directory?.items.map((agency) => (
              <li key={agency.id}>
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/agencies/${encodeURIComponent(agency.slug)}`}
                >
                  {agency.name}
                </Link>
              </li>
            ))}
          </ul>
          {!filters.country && (
            <Link
              className="inline-block text-primary underline"
              href={
                city === "all"
                  ? "/agencies"
                  : `/agencies?city=${encodeURIComponent(city)}`
              }
            >
              Browse rental agencies in {location.name}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
