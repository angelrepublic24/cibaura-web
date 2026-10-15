import type { Metadata } from "next";
import { Suspense } from "react";
import { parseCarFilters, type CarSearchFilters } from "@/features/cars/filters";
import { CarSearchResults } from "@/features/cars/components/car-search-results";
import { CarSearchSkeleton } from "@/features/cars/components/car-search-skeleton";
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
 * STATUS CODE: this route is the main organic landing page, so an unknown
 * city slug must answer a real 404 — never "200 and empty", which tells
 * Google the URL exists. That is why there is NO `loading.tsx` here: a
 * route-level loading file wraps the segment in Suspense, and the 200 shell
 * is already on the wire before the page body can call `notFound()`. The
 * skeleton instead lives on an in-page boundary BELOW the gate (see
 * `<CityResults/>`), which keeps both. `scripts/seo-smoke.mjs` asserts the
 * status codes against a production server so this cannot regress silently.
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
  // 404 GATE — awaited in the page body, so an unknown city, country or
  // region is decided before the first byte leaves. Nothing rendered below
  // may call notFound(): by then the 200 is committed.
  const location = await getPublicCity(city, filters.country, filters.region);

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
      <Suspense fallback={<CarSearchSkeleton />}>
        <CityResults city={city} cityName={location.name} filters={filters} />
      </Suspense>
    </div>
  );
}

/**
 * Everything that needs the API. Streams in behind `<CarSearchSkeleton/>`, so
 * the page frame paints immediately instead of waiting out a round trip —
 * dated searches run with `revalidate: 0`, so they always pay for one.
 *
 * Only reachable once the city exists, and it never calls `notFound()`: the
 * prefetch helpers throw on failure (→ the error boundary), they do not 404.
 */
async function CityResults({
  city,
  cityName,
  filters,
}: {
  city: string;
  cityName: string;
  filters: CarSearchFilters;
}) {
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
    <>
      <HydrationBoundary state={dehydrate(client)}>
        <CarSearchResults city={city} cityName={cityName} filters={filters} />
      </HydrationBoundary>
      {!hasDates && (
        <section className="mt-10 space-y-4">
          <h2 className="font-display text-2xl">Rent a car in {cityName}</h2>
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
              Browse rental agencies in {cityName}
            </Link>
          )}
        </section>
      )}
    </>
  );
}
