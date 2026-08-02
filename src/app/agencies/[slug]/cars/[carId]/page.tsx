import { parseCarFilters } from "@/features/cars/filters";
import { CarDetail } from "@/features/cars/components/car-detail";

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

export default async function CarDetailPage({ params, searchParams }: Props) {
  const { carId } = await params;
  const filters = parseCarFilters(await searchParams);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CarDetail
        carId={carId}
        initialFrom={filters.from}
        initialTo={filters.to}
      />
    </div>
  );
}
