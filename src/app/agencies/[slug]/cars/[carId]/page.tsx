import { parseCarFilters } from "@/features/cars/filters";
import { CarDetail } from "@/features/cars/components/car-detail";
import { pageMetadata } from "@/shared/seo/metadata";
import {
  carDescription,
  carPath,
  carTitle,
  getPublicAgency,
  getPublicCar,
} from "@/shared/seo/public-api";
import { BreadcrumbJsonLd, VehicleJsonLd } from "@/shared/seo/structured-data";
import { carGallery } from "@/features/cars/photos";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { carKeys } from "@/features/cars/api";
import { getAgencyReviews, publicQueryClient } from "@/shared/seo/prefetch";
import { agencyProfileKeys } from "@/features/agencies/api";
import { AgencyReviews } from "@/features/agencies/components/agency-profile";
import { StarRating } from "@/shared/components/star-rating";
import Link from "next/link";

/**
 * /agencies/[slug]/cars/[carId] — agency-scoped car detail (Beusun-style
 * store-scoped product URL). The `slug` segment is canonical/cosmetic; the
 * `carId` does the fetching. Trip dates ride in the query string so the
 * SERVER-side quote panel pre-fills them.
 */
type Props = {
  params: Promise<{ slug: string; carId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const car = await getPublicCar((await params).carId);
  return pageMetadata({
    title: `${carTitle(car)} rental in ${car.branch.city.name}`,
    description: carDescription(car),
    path: carPath(car),
    image: carGallery(car)[0],
  });
}

export default async function CarDetailPage({ params, searchParams }: Props) {
  const { carId } = await params;
  const car = await getPublicCar(carId);
  const agency = await getPublicAgency(car.agency.slug);
  const reviews = await getAgencyReviews(agency.slug);
  const filters = parseCarFilters(await searchParams);
  const client = publicQueryClient();
  client.setQueryData(carKeys.detail(carId), car);
  if (reviews)
    client.setQueryData(agencyProfileKeys.reviews(agency.slug, 1), reviews);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <VehicleJsonLd car={car} agency={agency} reviews={reviews?.items ?? []} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Agencies", path: "/agencies" },
          {
            name: car.agency.name,
            path: `/agencies/${encodeURIComponent(car.agency.slug)}`,
          },
          { name: carTitle(car), path: carPath(car) },
        ]}
      />
      <HydrationBoundary state={dehydrate(client)}>
        <CarDetail
          carId={carId}
          initialFrom={filters.from}
          initialTo={filters.to}
        />
        {agency.reviewCount > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="font-display text-2xl">
              Reviews of{" "}
              <Link
                href={`/agencies/${encodeURIComponent(agency.slug)}`}
                className="text-primary hover:underline"
              >
                {agency.name}
              </Link>
            </h2>
            <p className="my-3 text-sm text-muted-foreground">
              These reviews describe rentals with this agency, across its fleet.
            </p>
            <StarRating rating={agency.ratingAvg} count={agency.reviewCount} />
            <AgencyReviews
              slug={agency.slug}
              reviewCount={agency.reviewCount}
            />
          </section>
        )}
      </HydrationBoundary>
    </div>
  );
}
