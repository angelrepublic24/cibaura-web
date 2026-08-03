import type { Metadata } from "next";
import { parseAgencyCarFilters } from "@/features/agencies/filters";
import { AgencyProfile } from "@/features/agencies/components/agency-profile";

/**
 * /agencies/[slug] — PUBLIC agency storefront (distinct from the private
 * /agency dashboard). Header + the SAME faceted filter panel as car search
 * + photo-forward car grid + reviews. Filters live in the URL (shareable),
 * so this server component normalizes them and hands a stable object to the
 * client, which derives its TanStack Query key from it.
 */
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = decodeURIComponent(slug).replace(/-/g, " ");
  return { title: `${name} — agency` };
}

export default async function AgencyProfilePage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const filters = parseAgencyCarFilters(await searchParams);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AgencyProfile slug={decodeURIComponent(slug)} filters={filters} />
    </div>
  );
}
