"use client";

import { useState } from "react";

import Link from "next/link";
import { ImagePlus, Settings2 } from "lucide-react";
import {
  useAgencyBranches,
  useAgencySession,
  useFleetPages,
} from "@/modules/agency/hooks/agency.hook";
import {
  storefrontBlockers,
  type StorefrontBlocker,
} from "@/modules/agency/helpers/agency.helper";
import { CarDocumentStatusBadge } from "@/modules/agency/components/car-registration-document";
import { PermissionGate } from "@/modules/agency/components/permission-gate";
import { usePermission } from "@/modules/agency/hooks/agency.hook";
import { carPhoto } from "@/modules/cars/helpers/cars.helper";
import { CarPhotoPlaceholder } from "@/modules/cars/components/car-photo-placeholder";
import type { AgencyCar } from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const STATUS_VARIANT = {
  draft: "secondary",
  active: "success",
  paused: "warning",
} as const;

/**
 * What each storefront blocker means to the host, and what to do about it
 * (BUG-006). One line per switch that is actually off — the backend ANDs
 * three of them, so naming only the first would send a host to fix one thing
 * and come back none the wiser.
 */
const BLOCKER_COPY: Record<StorefrontBlocker, string> = {
  draft: "still a draft — publish it from Manage",
  paused: "paused — resume it from Manage",
  branch_inactive: "its branch is deactivated — reactivate it under Branches",
  agency_unverified: "your agency is not verified yet",
};

/**
 * One searchable blob per car: make, model, year and plate, which is what a
 * host at a counter actually has to hand (BUG-005). Lower-cased once per
 * render pass rather than per keystroke per field.
 */
function haystack(car: AgencyCar): string {
  return [
    car.make?.name,
    car.model?.name,
    car.year,
    car.plate,
    car.color,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** /agency/fleet — the agency's cars (`fleet:read`), paged under a "Load more" button. */
export default function AgencyFleetPage() {
  return (
    <PermissionGate permission="fleet:read">
      <FleetList />
    </PermissionGate>
  );
}

function FleetList() {
  const { can, branchScope } = usePermission();
  const canWrite = can("fleet:write");
  // Individual hosts need a verified registration per car — surface it here.
  const session = useAgencySession();
  const showRegistration = session.data?.agency.kind === "individual";

  const query = useFleetPages();
  const loaded = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  /*
   * The branch list is read so each row can say whether ITS branch is
   * deactivated (BUG-006) — the fleet payload carries `branchId`, not the
   * branch. Reading it is unrestricted for agency members (the backend says
   * so: it feeds the car form and the staff scope picker), so this adds no
   * permission requirement to the fleet screen.
   */
  const branchesQuery = useAgencyBranches();
  const branchById = new Map(
    (branchesQuery.data ?? []).map((branch) => [branch.id, branch]),
  );

  /*
   * A plain substring filter over the cars ALREADY LOADED (BUG-005). It is
   * deliberately not a server query: the fleet is paged behind "Load more",
   * and a box that searched the server would disagree with the list under it
   * — and with the branch scope the server already applies. The count line
   * below says how many are loaded so the host can tell the difference
   * between "no match" and "not loaded yet".
   */
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const cars = needle
    ? loaded.filter((car) => haystack(car).includes(needle))
    : loaded;

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

      {/* Only once there is something to search: a filter over an empty or
          failed list is a control that cannot do anything. */}
      {loaded.length > 0 ? (
        <div className="mt-4 max-w-sm space-y-1.5">
          <Label htmlFor="fleet-search">Find a car</Label>
          <Input
            id="fleet-search"
            type="search"
            placeholder="Make, model, year or plate"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      ) : null}

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
          needle ? (
            /* A filter that matched nothing is not an empty fleet — and with
               more pages unloaded it is not even a complete answer. */
            <EmptyState
              title={`No loaded car matches “${search.trim()}”`}
              description={
                query.hasNextPage
                  ? `Searching the ${loaded.length} cars loaded so far. Load more below to widen it.`
                  : "Try part of the make, model, year or plate."
              }
              action={
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={
                query.hasNextPage
                  ? "No cars on these pages"
                  : "No cars available"
              }
              description={
                query.hasNextPage
                  ? "Load more to find cars in your assigned branches."
                  : "There are no cars available within your access."
              }
              action={
                canWrite ? (
                  <Link href="/agency/fleet/new" className={buttonVariants({})}>
                    Add car
                  </Link>
                ) : undefined
              }
            />
          )
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
                          <CoverThumb photo={photo} />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/agency/fleet/${car.id}`}
                            className="block truncate font-medium hover:text-primary hover:underline"
                          >
                            {car.make?.name ?? "Make"}{" "}
                            {car.model?.name ?? "Model"} {car.year}
                          </Link>
                          <p className="truncate text-sm text-muted-foreground">
                            {car.plate ? `${car.plate} · ` : ""}
                            {car.color} · {car.transmission} · {car.seats} seats
                          </p>
                          {showRegistration ? (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              Registration
                              <CarDocumentStatusBadge
                                document={car.registration ?? null}
                              />
                            </p>
                          ) : null}
                          <StorefrontStatus
                            blockers={storefrontBlockers({
                              car,
                              branch: branchById.get(car.branchId),
                              agency: session.data?.agency,
                            })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Link
                          href={`/agency/fleet/${car.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          <Settings2 className="mr-1.5 h-4 w-4" />
                          Manage
                        </Link>
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
                          {formatMoneyCents(car.hostDailyRateCents)}/day
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
          </>
        )}
        {!query.isLoading && !query.isError ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {needle
                ? `Showing ${cars.length} of ${loaded.length} loaded cars`
                : branchScope?.mode === "all"
                  ? `Showing ${cars.length} of ${total} cars`
                  : `Showing ${cars.length} accessible cars`}
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
        ) : null}
      </div>
    </div>
  );
}

/**
 * WHETHER THIS CAR IS ON THE PUBLIC STOREFRONT, and why not (BUG-006).
 *
 * The reported symptom was a car present in this list and absent from the
 * agency's public page. That is the designed behaviour — this list is the
 * agency's inventory, the storefront applies three further conditions — but
 * the screen said nothing, so the only reading left was "the site lost my
 * car". Now the row answers it where the question is asked.
 */
function StorefrontStatus({ blockers }: { blockers: StorefrontBlocker[] }) {
  if (blockers.length === 0) {
    return (
      <p className="mt-1 text-xs text-success">Live on your public page</p>
    );
  }
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Not on your public page: {blockers.map((b) => BLOCKER_COPY[b]).join("; ")}
    </p>
  );
}

/**
 * Miniatura de portada con fallback. Un `<img>` plano sin `onError` dejaba un
 * recuadro roto cuando la foto existía pero fallaba al cargar (BUG-002) — solo
 * caía al placeholder cuando NO había foto. Ahora también cae al placeholder si
 * la carga falla (404, error de S3, red).
 */
function CoverThumb({ photo }: { photo: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) return <CarPhotoPlaceholder />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt=""
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
