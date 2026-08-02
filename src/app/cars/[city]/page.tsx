import type { Metadata } from "next";
import { parseCarFilters } from "@/features/cars/filters";
import { CarSearchResults } from "@/features/cars/components/car-search-results";

/**
 * /cars/[city] — search results. Filters live in the URL (shareable +
 * SEO); this server component normalizes them and hands a stable filter
 * object to the client, which derives its TanStack Query key from it.
 */
type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  return { title: `Cars in ${decodeURIComponent(city)}` };
}

export default async function CarsByCityPage({ params, searchParams }: Props) {
  const { city } = await params;
  const filters = parseCarFilters(await searchParams);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CarSearchResults city={decodeURIComponent(city)} filters={filters} />
    </div>
  );
}
