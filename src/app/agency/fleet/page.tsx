"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { buttonVariants } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

const STATUS_VARIANT = {
  draft: "secondary",
  active: "success",
  paused: "warning",
} as const;

/** /agency/fleet — the agency's cars. */
export default function AgencyFleetPage() {
  const { can } = usePermission();
  const canWrite = can("fleet:write");

  const query = useQuery({
    queryKey: agencyKeys.fleet(),
    queryFn: () => AgencyApi.fleet(),
  });

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
        ) : (query.data?.items.length ?? 0) === 0 ? (
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
          <div className="space-y-3">
            {query.data!.items.map((car) => (
              <Card key={car.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">
                      {car.make?.name ?? "Make"} {car.model?.name ?? "Model"}{" "}
                      {car.year}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {car.plate ? `${car.plate} · ` : ""}
                      {car.color} · {car.transmission} · {car.seats} seats
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">
                      {formatMoneyCents(car.pricePerDayCents)}/day
                    </span>
                    <Badge variant={STATUS_VARIANT[car.status]}>
                      {car.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
