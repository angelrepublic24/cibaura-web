"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { useAgencySession, useAllFleet } from "@/features/agency/hooks";
import { CarRegistrationDocumentCard } from "@/features/agency/components/car-registration-document";
import { CarForm } from "@/features/agency/components/new-car-form";
import { PermissionGate } from "@/features/agency/components/permission-gate";
import { usePermission } from "@/features/agency/use-permission";
import { carPhoto } from "@/features/cars/photos";
import { CarPhotoPlaceholder } from "@/features/cars/components/car-photo-placeholder";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type { AgencyCar, CarStatus } from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

const STATUS_VARIANT: Record<CarStatus, "secondary" | "success" | "warning"> = {
  draft: "secondary",
  active: "success",
  paused: "warning",
};

/**
 * /agency/fleet/[carId] — one car: publish/pause, edit the listing, the
 * registration document and a shortcut to the gallery. The agency has no
 * single-car read, so the car comes from the fleet walk (`useAllFleet`);
 * every mutation invalidates the fleet prefix so the row and this page
 * agree.
 */
export function CarManage({ carId }: { carId: string }) {
  return (
    <PermissionGate permission="fleet:read">
      <CarManageBody carId={carId} />
    </PermissionGate>
  );
}

function CarManageBody({ carId }: { carId: string }) {
  const fleet = useAllFleet();
  const { can } = usePermission();
  const canWrite = can("fleet:write");

  if (fleet.isLoading) return <LoadingState label="Loading car…" />;
  if (fleet.isError) {
    return (
      <ErrorState
        title="Could not load this car"
        message={getErrorMessage(fleet.error, "Please try again.")}
        onRetry={() => void fleet.refetch()}
      />
    );
  }

  const car = fleet.cars.find((c) => c.id === carId);
  if (!car) {
    return (
      <EmptyState
        title="This car is not in your fleet"
        description="It may have been removed, or the link is from another agency."
        action={
          <Link href="/agency/fleet" className={buttonVariants({ variant: "outline" })}>
            Back to fleet
          </Link>
        }
      />
    );
  }

  const photo = carPhoto(car);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/agency/fleet"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to fleet
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <CarPhotoPlaceholder />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
              {car.make.name} {car.model.name} {car.year}
              <Badge variant={STATUS_VARIANT[car.status]}>{car.status}</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {car.plate ? `${car.plate} · ` : ""}
              {formatMoneyCents(car.pricePerDayCents)}/day
              {car.depositCents !== null
                ? ` · deposit ${formatMoneyCents(car.depositCents)}`
                : " · platform default deposit"}
            </p>
          </div>
        </div>
      </div>

      {canWrite ? <PublishCard car={car} /> : null}

      <CarRegistrationDocumentCard carId={car.id} canUpload={canWrite} />

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing details</CardTitle>
            <CardDescription>
              Catalog make/model, specs, the private plate, your daily rate
              and the security deposit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CarForm mode="edit" car={car} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-medium text-foreground">Photos</p>
            <p className="text-sm text-muted-foreground">
              {car.photos.length} photo{car.photos.length === 1 ? "" : "s"} —
              the first one is the cover on search results.
            </p>
          </div>
          {canWrite ? (
            <Link
              href={`/agency/fleet/${car.id}/photos`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ImagePlus className="mr-1.5 h-4 w-4" />
              Manage photos
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** Copy for the activation gates (spec §4/B6); anything else → server message. */
function describeStatusError(error: unknown): {
  message: string;
  action?: { label: string; href: string };
} {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.HOST_AGREEMENT_REQUIRED:
      return {
        message:
          "Sign the host agreement before publishing a car. The owner can do it from Settings.",
        action: { label: "Open settings", href: "/agency/settings" },
      };
    case API_ERROR_CODES.CAR_REGISTRATION_REQUIRED:
      return {
        message:
          "This car's registration document must be uploaded and verified by our team before it can be published.",
      };
    default:
      return {
        message: getErrorMessage(error, "Could not change the car's status."),
      };
  }
}

function PublishCard({ car }: { car: AgencyCar }) {
  const qc = useQueryClient();
  const session = useAgencySession();
  const agency = session.data?.agency;

  const setStatus = useMutation({
    mutationFn: (status: CarStatus) => AgencyApi.updateCar(car.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agencyKeys.fleetAll() });
    },
  });

  // Proactive hints mirroring the server gates — the server still decides.
  const agreementMissing = agency?.hostAgreementSigned === false;
  const registrationMissing =
    agency?.kind === "individual" && car.registration?.status !== "verified";
  const notVerified =
    agency !== undefined && agency.verificationStatus !== "verified";

  const error = setStatus.isError ? describeStatusError(setStatus.error) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visibility</CardTitle>
        <CardDescription>
          {car.status === "active"
            ? "This car appears in search and accepts booking requests."
            : car.status === "paused"
              ? "Paused — hidden from search; existing bookings are unaffected."
              : "Draft — not visible to renters yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {car.status !== "active" ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {notVerified ? (
              <li>· Your account must be verified by our team first.</li>
            ) : null}
            {agreementMissing ? (
              <li>
                · The host agreement is not signed —{" "}
                <Link href="/agency/settings" className="text-primary underline">
                  sign it in Settings
                </Link>
                .
              </li>
            ) : null}
            {registrationMissing ? (
              <li>· The registration document below must be verified.</li>
            ) : null}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {car.status !== "active" ? (
            <Button
              type="button"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("active")}
            >
              {setStatus.isPending ? "Publishing…" : "Publish"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("paused")}
            >
              {setStatus.isPending ? "Pausing…" : "Pause"}
            </Button>
          )}
          {car.status === "paused" ? (
            <Button
              type="button"
              variant="ghost"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("draft")}
            >
              Back to draft
            </Button>
          ) : null}
        </div>

        {error ? (
          <div
            className="space-y-1 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{error.message}</p>
            {error.action ? (
              <Link
                href={error.action.href}
                className="text-sm font-medium text-red-800 underline underline-offset-2"
              >
                {error.action.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
