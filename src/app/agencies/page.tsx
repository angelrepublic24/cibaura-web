import type { Metadata } from "next";
import { parseAgencyDirectoryFilters } from "@/features/agencies/filters";
import { AgencyDirectory } from "@/features/agencies/components/agency-directory";
import { pageMetadata } from "@/shared/seo/metadata";
import { BreadcrumbJsonLd } from "@/shared/seo/structured-data";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { agencyProfileKeys } from "@/features/agencies/api";
import {
  getDirectory,
  prefetchCities,
  publicQueryClient,
} from "@/shared/seo/prefetch";

/**
 * /agencies — PUBLIC agency directory. Browse verified agencies, filter by city
 * and sort by rating — filters live in the URL (shareable), exactly like the
 * car search. Server prefetch and client queries use the same normalized key.
 */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Agencies",
    description:
      "Browse verified rental agencies and private hosts in the Dominican Republic. Explore their cars and rental conditions.",
    path: "/agencies",
  });
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AgenciesPage({ searchParams }: Props) {
  const filters = parseAgencyDirectoryFilters(await searchParams);
  const client = publicQueryClient();
  await Promise.all([
    client.fetchQuery({
      queryKey: agencyProfileKeys.directory(filters),
      queryFn: () => getDirectory(filters),
    }),
    prefetchCities(client),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Agencies", path: "/agencies" },
        ]}
      />
      <HydrationBoundary state={dehydrate(client)}>
        <AgencyDirectory filters={filters} />
      </HydrationBoundary>
    </div>
  );
}
