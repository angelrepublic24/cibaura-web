"use client";

import Link from "next/link";
import { ImagePlus } from "lucide-react";
import { useFleetPages } from "@/features/agency/hooks";
import { PermissionGate } from "@/features/agency/components/permission-gate";
import { usePermission } from "@/features/agency/use-permission";
import { carPhoto } from "@/features/cars/photos";
import { CarPhotoPlaceholder } from "@/features/cars/components/car-photo-placeholder";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

const STATUS_VARIANT = {
  draft: "secondary",
  active: "success",
  paused: "warning",
} as const;

/** /agency/fleet — the agency's cars (`fleet:read`), paged under a "Load more" button. */
export default function AgencyFleetPage() {
  return (
    <PermissionGate permission="fleet:read">
      <FleetList />
    </PermissionGate>
  );
}

function FleetList() {
  const { can } = usePermission();
  const canWrite = can("fleet:write");

  const query = useFleetPages();
  const cars = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fleet</h1>
        {canWrite ? (
          <Link href="/agency/fleet/new" className={buttonVariants({})}>
            Add car
          </Link>
        ) : null}
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <LoadingState label="Loading fleet…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load your fleet"
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : cars.length === 0 ? (
          <EmptyState
            title="No cars yet"
            description="Add your first car to start receiving booking requests."
            action={
              canWrite ? (
                <Link href="/agency/fleet/new" className={buttonVariants({})}>
                  Add car
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {cars.map((car) => {
                const photo = carPhoto(car);
                return (
                  <Card key={car.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Cover thumb — real photo or the branded placeholder. */}
                        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <CarPhotoPlaceholder />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {car.make?.name ?? "Make"} {car.model?.name ?? "Model"}{" "}
                            {car.year}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {car.plate ? `${car.plate} · ` : ""}
                            {car.color} · {car.transmission} · {car.seats} seats
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {canWrite ? (
                          <Link
                            href={`/agency/fleet/${car.id}/photos`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            <ImagePlus className="mr-1.5 h-4 w-4" />
                            Photos
                          </Link>
                        ) : null}
                        <span className="font-semibold">
                          {formatMoneyCents(car.pricePerDayCents)}/day
                        </span>
                        <Badge variant={STATUS_VARIANT[car.status]}>
                          {car.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Showing {cars.length} of {total} car{total === 1 ? "" : "s"}
              </p>
              {query.hasNextPage ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
