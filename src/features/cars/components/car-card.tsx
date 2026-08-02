"use client";

import Link from "next/link";
import Image from "next/image";
import { Users, Gauge, Fuel } from "lucide-react";
import type { Car } from "@/shared/types/domain";
import { carPhoto } from "@/features/cars/photos";
import { formatMoneyCents } from "@/shared/utils/money";
import { Badge } from "@/shared/components/ui/badge";

/**
 * Photo-forward car card — the primary unit of the marketplace grid.
 * Large image up top (real photo or a category stock fallback), then the
 * make/model/year, a linked agency name, key specs as quiet chips and a
 * prominent price/day. Reused by search results AND the agency profile.
 *
 * `href` points at the detail page (dates carried in the query string by
 * the caller). `agencyHref` (optional) links the agency name to its public
 * profile; when omitted the agency name renders as plain text.
 */
export function CarCard({
  car,
  href,
  agencyHref,
}: {
  car: Car;
  href: string;
  agencyHref?: string;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={carPhoto(car)}
            alt={`${car.make.name} ${car.model.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            unoptimized
          />
          <div className="absolute left-3 top-3">
            <Badge
              variant="secondary"
              className="bg-surface/90 capitalize shadow-sm backdrop-blur"
            >
              {car.category}
            </Badge>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="min-w-0">
            <h3 className="truncate font-semibold leading-tight text-foreground">
              {car.make.name} {car.model.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{car.year}</p>
          </Link>
        </div>

        {/* Agency line — links to the public agency profile when provided. */}
        <p className="mt-1 text-sm text-muted-foreground">
          by{" "}
          {agencyHref ? (
            <Link
              href={agencyHref}
              className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              {car.agency.name}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{car.agency.name}</span>
          )}
        </p>

        {/* Key specs as small quiet chips. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 capitalize">
            <Gauge className="h-3.5 w-3.5" />
            {car.transmission}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {car.seats} seats
          </span>
          <span className="inline-flex items-center gap-1.5 capitalize">
            <Fuel className="h-3.5 w-3.5" />
            {car.fuel}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
          <p className="text-lg font-bold text-foreground">
            {formatMoneyCents(car.pricePerDayCents)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / day
            </span>
          </p>
          <Link
            href={href}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
