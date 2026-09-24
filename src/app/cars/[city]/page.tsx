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
  getDirectory,
  prefetchCities,
  publicQueryClient,
} from "@/shared/seo/prefetch";

/**
 * /cars/[city] — search results. Filters live in the URL (shareable +
 * SEO). Availability is prefetched only with dates. Without dates, render
 * the real city and agency links until a date-free car catalog exists.
 */
type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const { name } = await getPublicCity(city);
  return pageMetadata({
    title: `Cars in ${name}`,
    description: `Search rental cars in ${name}. Choose your dates, compare local agencies and private hosts, and request a booking on Cibaura.`,
    path: `/cars/${encodeURIComponent(city)}`,
  });
}

export default async function CarsByCityPage({ params, searchParams }: Props) {
  const { city } = await params;
  const location = await getPublicCity(city);
  const filters = parseCarFilters(await searchParams);
  const client = publicQueryClient();
  const hasDates = !!filters.from && !!filters.to;
  const [, directory] = await Promise.all([
    Promise.all([
      prefetchCities(client),
      hasDates
        ? client.fetchQuery({
            queryKey: carKeys.search(city, filters),
            queryFn: () => getCarSearch(city, filters),
          })
        : Promise.resolve(),
    ]),
    hasDates
      ? Promise.resolve(null)
      : getDirectory({ city: city === "all" ? undefined : city }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          {
            name: city === "all" ? "All cities" : location.name,
            path: `/cars/${encodeURIComponent(city)}`,
          },
        ]}
      />
      <HydrationBoundary state={dehydrate(client)}>
        <CarSearchResults
          city={city}
          cityName={city === "all" ? "All cities" : location.name}
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
        </section>
      )}
    </div>
  );
}
