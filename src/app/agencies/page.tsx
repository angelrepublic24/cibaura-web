"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Building2, Car as CarIcon, MapPin } from "lucide-react";
import { AgenciesApi, agencyProfileKeys } from "@/features/agencies/api";
import { CatalogApi, catalogKeys } from "@/features/catalog/api";
import { StarRating } from "@/shared/components/star-rating";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * /agencies — public agency directory. Browse verified agencies, filter by
 * city, and see each agency's rating (stars + review count) before opening its
 * storefront.
 */
export default function AgencyDirectoryPage() {
  const [city, setCity] = useState<string>("");

  const citiesQuery = useQuery({
    queryKey: catalogKeys.cities(),
    queryFn: CatalogApi.listCities,
  });

  const query = useQuery({
    queryKey: agencyProfileKeys.directory(city || undefined, 1),
    queryFn: () => AgenciesApi.directory({ city: city || undefined }),
  });

  const agencies = query.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Agencies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified rent-a-car agencies — browse by city and see their ratings.
          </p>
        </div>
        <div className="w-52 space-y-1.5">
          <Label htmlFor="dir-city" className="text-xs">
            City
          </Label>
          <Select
            id="dir-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">All cities</option>
            {(citiesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <LoadingState label="Loading agencies…" className="py-16" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load agencies"
            message={(query.error as Error).message}
            onRetry={() => query.refetch()}
          />
        ) : agencies.length === 0 ? (
          <EmptyState
            title="No agencies here yet"
            description="Try another city — or check back soon."
            className="py-16"
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.map((a) => (
              <Link key={a.id} href={`/agencies/${a.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-border-strong">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                        {a.logoUrl ? (
                          <Image
                            src={a.logoUrl}
                            alt={a.name}
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
                          {a.name}
                        </h2>
                        <StarRating rating={a.ratingAvg} count={a.reviewCount} />
                      </div>
                    </div>

                    {a.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {a.description}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CarIcon className="h-3.5 w-3.5" />
                        {a.carCount} car{a.carCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {a.cities.map((c) => c.name).join(", ") || "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
