import type { Metadata } from "next";
import { parseAgencyCarFilters } from "@/features/agencies/filters";
import { AgencyProfile } from "@/features/agencies/components/agency-profile";
import { pageMetadata } from "@/shared/seo/metadata";
import { getPublicAgency } from "@/shared/seo/public-api";
import { AgencyJsonLd, BreadcrumbJsonLd } from "@/shared/seo/structured-data";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { agencyProfileKeys } from "@/features/agencies/api";
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
  const agency = await getPublicAgency(slug);
  const filters = parseAgencyCarFilters(await searchParams);
  const client = publicQueryClient();
  client.setQueryData(agencyProfileKeys.profile(slug), agency);
  const [, reviews] = await Promise.all([
    client.fetchQuery({
      queryKey: agencyProfileKeys.cars(slug, filters),
      queryFn: () => getAgencyCars(slug, filters),
    }),
    getAgencyReviews(slug),
  ]);
  if (reviews) client.setQueryData(agencyProfileKeys.reviews(slug, 1), reviews);
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
      <HydrationBoundary state={dehydrate(client)}>
        <AgencyProfile slug={slug} filters={filters} />
      </HydrationBoundary>
    </div>
  );
}
