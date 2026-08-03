import type { Metadata } from "next";
import { parseAgencyDirectoryFilters } from "@/features/agencies/filters";
import { AgencyDirectory } from "@/features/agencies/components/agency-directory";

/**
 * /agencies — PUBLIC agency directory. Browse verified agencies, filter by city
 * and sort by rating — filters live in the URL (shareable), exactly like the
 * car search. This server component normalizes them and hands a stable object
 * to the client, which derives its TanStack Query key from it.
 */
export const metadata: Metadata = {
  title: "Agencies",
  description: "Browse verified rent-a-car agencies by city and rating.",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AgenciesPage({ searchParams }: Props) {
  const filters = parseAgencyDirectoryFilters(await searchParams);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AgencyDirectory filters={filters} />
    </div>
  );
}
