import Link from "next/link";
import Image from "next/image";
import { Building2, Car as CarIcon, MapPin } from "lucide-react";
import type { AgencyPublicProfile } from "@/features/agencies/api";
import { StarRating } from "@/shared/components/star-rating";
import { FavoriteButton } from "@/shared/components/favorite-button";
import { Card, CardContent } from "@/shared/components/ui/card";

/**
 * Public agency card used by the directory and the favourites page. The heart
 * sits OVER the card (a sibling of the Link, not nested inside the anchor) so it
 * toggles the favourite without navigating.
 */
export function AgencyPublicCard({ agency }: { agency: AgencyPublicProfile }) {
  return (
    <div className="relative">
      <Link href={`/agencies/${agency.slug}`} className="group block">
        <Card className="h-full transition-colors group-hover:border-border-strong">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3 pr-10">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                {agency.logoUrl ? (
                  <Image
                    src={agency.logoUrl}
                    alt={agency.name}
                    fill
                    sizes="44px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-medium text-foreground group-hover:text-primary">
                  {agency.name}
                </h2>
                <StarRating rating={agency.ratingAvg} count={agency.reviewCount} />
              </div>
            </div>

            {agency.description ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {agency.description}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CarIcon className="h-3.5 w-3.5" />
                {agency.carCount} car{agency.carCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {agency.cities.map((c) => c.name).join(", ") || "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
      <FavoriteButton agencyId={agency.id} className="absolute right-3 top-3 z-10" />
    </div>
  );
}
