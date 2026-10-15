import type { Metadata } from "next";
import { Suspense } from "react";
import { parseAgencyCarFilters } from "@/features/agencies/filters";
import { AgencyProfile } from "@/features/agencies/components/agency-profile";
import { AgencyProfileSkeleton } from "@/features/agencies/components/agency-profile-skeleton";
import { pageMetadata } from "@/shared/seo/metadata";
import { getPublicAgency } from "@/shared/seo/public-api";
import { AgencyJsonLd, BreadcrumbJsonLd } from "@/shared/seo/structured-data";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { agencyProfileKeys } from "@/features/agencies/api";
import type {
  AgencyCarsFilters,
  AgencyPublicProfile,
  Review,
} from "@/features/agencies/api";
import type { Paginated } from "@/shared/types/domain";
import {
  getAgencyCars,
  getAgencyReviews,
  publicQueryClient,
} from "@/shared/seo/prefetch";

/**
 * /agencies/[slug] — PUBLIC agency storefront (distinct from the private
 * /agency dashboard). Header + the SAME faceted filter panel as car search
 * + photo-forward car grid + reviews. Filters live in the URL (shareable),
 * with the same query keys prefetched on the server and hydrated in the client.
 *
 * STATUS CODE: an unknown or unverified slug must answer a real 404. There is
 * deliberately NO `loading.tsx` on this route — a route-level loading file
 * wraps the segment in Suspense and flushes a 200 shell before the page body
 * can call `notFound()`, so every made-up slug would read as "exists, empty".
 * The skeleton lives on an in-page boundary BELOW the gate instead.
 */
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const agency = await getPublicAgency(slug);
  return pageMetadata({
    title: `${agency.name} — car rentals`,
    description:
      agency.description ||
      `Explore rental cars from ${agency.name} in the Dominican Republic. View vehicles and rental conditions on Cibaura.`,
    path: `/agencies/${encodeURIComponent(agency.slug)}`,
  });
}

export default async function AgencyProfilePage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  // 404 GATE — awaited in the page body, so an unknown or unverified agency is
  // decided before the first byte leaves. Nothing rendered below may call
  // notFound(): by then the 200 is committed.
  const agency = await getPublicAgency(slug);
  const filters = parseAgencyCarFilters(await searchParams);
  // Reviews stay in the shell with the structured data they feed: the helper
  // swallows its own failures (returns null), so awaiting it cannot change the
  // status code, and the JSON-LD then never has to travel in a streamed
  // boundary where only a JS-executing crawler would reach it.
  const reviews = await getAgencyReviews(slug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AgencyJsonLd agency={agency} reviews={reviews?.items ?? []} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Agencies", path: "/agencies" },
          {
            name: agency.name,
            path: `/agencies/${encodeURIComponent(agency.slug)}`,
          },
        ]}
      />
      <Suspense fallback={<AgencyProfileSkeleton />}>
        <AgencyStorefront
          slug={slug}
          agency={agency}
          reviews={reviews}
          filters={filters}
        />
      </Suspense>
    </div>
  );
}

/**
 * The fleet. Streams in behind `<AgencyProfileSkeleton/>` so the page frame
 * paints without waiting out the paginated car fetch.
 *
 * The profile is already resolved by the gate and is only seeded into the
 * query cache here, so this never re-enters `getPublicAgency` — re-reading a
 * rejected `cache()` memo inside the boundary would re-throw the 404 at a
 * point where the status is already committed. `getAgencyCars` throws on
 * failure (→ the error boundary); it never 404s.
 */
async function AgencyStorefront({
  slug,
  agency,
  reviews,
  filters,
}: {
  slug: string;
  agency: AgencyPublicProfile;
  reviews: Paginated<Review> | null;
  filters: AgencyCarsFilters;
}) {
  const client = publicQueryClient();
  client.setQueryData(agencyProfileKeys.profile(slug), agency);
  if (reviews) client.setQueryData(agencyProfileKeys.reviews(slug, 1), reviews);
  await client.fetchQuery({
    queryKey: agencyProfileKeys.cars(slug, filters),
    queryFn: () => getAgencyCars(slug, filters),
  });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <AgencyProfile slug={slug} filters={filters} />
    </HydrationBoundary>
  );
}
