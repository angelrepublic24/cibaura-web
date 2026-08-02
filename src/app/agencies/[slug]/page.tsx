import type { Metadata } from "next";
import { AgencyProfile } from "@/features/agencies/components/agency-profile";

/**
 * /agencies/[slug] — PUBLIC agency storefront (distinct from the private
 * /agency dashboard). Header + filter bar + photo-forward car grid.
 */
type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = decodeURIComponent(slug).replace(/-/g, " ");
  return { title: `${name} — agency` };
}

export default async function AgencyProfilePage({ params }: Props) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AgencyProfile slug={decodeURIComponent(slug)} />
    </div>
  );
}
