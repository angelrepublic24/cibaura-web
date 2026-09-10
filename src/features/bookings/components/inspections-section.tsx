"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { BookingsApi } from "@/features/bookings/api";
import {
  invalidateBooking,
  useBookingInspections,
} from "@/features/bookings/hooks";
import {
  fuelLevelText,
  inspectionStatusMeta,
  inspectionTypeLabel,
} from "@/features/bookings/labels";
import {
  INSPECTION_DISPUTE_NOTE_MAX,
  disputeInspectionSchema,
  type DisputeInspectionFormValues,
} from "@/features/bookings/schemas";
import { InspectionMediaGrid } from "@/features/bookings/components/inspection-media-viewer";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import type { BookingDetail, InspectionDto } from "@/shared/types/domain";
import { formatDateTime } from "@/shared/utils/dates";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

const TYPE_ORDER: Record<string, number> = { checkin: 0, checkout: 1 };

/**
 * Check-in / check-out records for the customer (ADR-0011). Renders nothing
 * until the booking says an inspection exists; then loads the full records
 * with their signed media and offers confirm / dispute while one is
 * `submitted`. Confirming (or disputing) finalizes the record and moves
 * the booking — check-in → `active`, check-out → `returned` — server-side.
 */
export function InspectionsSection({ booking }: { booking: BookingDetail }) {
  // `inspections` is required on the wire (spec §5) but absent from
  // pre-expansion backends — never let a missing array break the page.
  const hasAny = (booking.inspections ?? []).length > 0;
  const query = useBookingInspections(booking.id, hasAny);

  if (!hasAny) return null;

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehicle inspections</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState label="Loading inspections…" className="py-6" />
        </CardContent>
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehicle inspections</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Could not load the inspections"
            message={getErrorMessage(query.error, "Please try again.")}
            onRetry={() => query.refetch()}
            className="py-8"
          />
        </CardContent>
      </Card>
    );
  }

  const inspections = [...(query.data ?? [])].sort(
    (a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9),
  );
  if (inspections.length === 0) return null;

  return (
    <div className="space-y-4">
      {inspections.map((inspection) => (
        <InspectionCard
          key={inspection.id}
          booking={booking}
          inspection={inspection}
        />
      ))}
    </div>
  );
}

/** Copy for the confirm/dispute-time codes (spec §0.2); else the server message. */
function describeActionError(error: unknown): string {
  if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_WRONG_STATE)) {
    return "This record can no longer be confirmed or disputed — it was already finalized. Refreshing…";
  }
  return getErrorMessage(error, "Your response could not be saved. Please try again.");
}

function InspectionCard({
  booking,
  inspection,
}: {
  booking: BookingDetail;
  inspection: InspectionDto;
}) {
  const qc = useQueryClient();
  const meta = inspectionStatusMeta(inspection.status);
  const typeLabel = inspectionTypeLabel(inspection.type);
  const isCheckin = inspection.type === "checkin";
  const [disputing, setDisputing] = useState(false);

  const form = useForm<DisputeInspectionFormValues>({
    resolver: zodResolver(disputeInspectionSchema),
    defaultValues: { note: "" },
  });

  const settle = () => {
    invalidateBooking(qc, booking.id);
  };
  const onActionError = (error: unknown) => {
    if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_WRONG_STATE)) settle();
  };

  const confirm = useMutation({
    mutationFn: () => BookingsApi.confirmInspection(booking.id, inspection.id),
    onSuccess: settle,
    onError: onActionError,
  });
  const dispute = useMutation({
    mutationFn: (values: DisputeInspectionFormValues) =>
      BookingsApi.disputeInspection(booking.id, inspection.id, values.note),
    onSuccess: () => {
      form.reset();
      setDisputing(false);
      settle();
    },
    onError: onActionError,
  });
  const busy = confirm.isPending || dispute.isPending;
  const actionError = confirm.isError
    ? confirm.error
    : dispute.isError
      ? dispute.error
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            {typeLabel} inspection
          </CardTitle>
          <Badge variant={meta.tone}>{meta.label}</Badge>
        </div>
        <CardDescription>
          {isCheckin
            ? `Recorded by ${booking.agency.name} when handing the car over.`
            : `Recorded by ${booking.agency.name} when the car came back.`}
          {inspection.submittedAt
            ? ` Submitted ${formatDateTime(inspection.submittedAt)}.`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {inspection.status === "draft" ? (
          <p className="text-muted-foreground">
            The host is still preparing this record. You will be asked to
            confirm it once it is submitted.
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-sm)] bg-muted/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Odometer
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {inspection.odometerKm !== null
                ? `${inspection.odometerKm.toLocaleString("en-US")} km`
                : "Not recorded"}
            </dd>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-muted/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Fuel level
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {fuelLevelText(inspection.fuelLevelEighths)}
            </dd>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-muted/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Damage
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {inspection.damageFlagged ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> Flagged by the host
                </span>
              ) : (
                "None flagged"
              )}
            </dd>
          </div>
        </dl>

        {inspection.damageNotes ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Host&apos;s notes
            </p>
            <p className="mt-1 whitespace-pre-line rounded-[var(--radius-sm)] bg-muted/60 p-3 leading-relaxed text-foreground">
              {inspection.damageNotes}
            </p>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Photos and videos
          </p>
          <InspectionMediaGrid media={inspection.media} />
        </div>

        {inspection.status === "confirmed" ? (
          <p className="text-muted-foreground">
            You confirmed this record on{" "}
            {formatDateTime(inspection.customerConfirmedAt)}.
          </p>
        ) : inspection.status === "confirmed_absent" ? (
          <p className="text-muted-foreground">
            The host recorded this without you present
            {inspection.customerAbsentReason
              ? `: “${inspection.customerAbsentReason}”`
              : ""}
            . If you disagree with it, contact us through the booking chat.
          </p>
        ) : inspection.status === "disputed" ? (
          <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3 text-red-800">
            <p className="font-medium">You disputed this record.</p>
            {inspection.customerDisputeNote ? (
              <p className="mt-1 whitespace-pre-line">
                “{inspection.customerDisputeNote}”
              </p>
            ) : null}
            <p className="mt-1 text-xs text-red-700">
              Our team has been alerted and will take your note into account
              in any damage claim.
            </p>
          </div>
        ) : inspection.status === "void" ? (
          <p className="text-muted-foreground">
            This record was voided when the booking was cancelled.
          </p>
        ) : null}

        {inspection.status === "submitted" ? (
          <div className="space-y-3 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Please review this record.</span>{" "}
              {isCheckin
                ? "Confirming means you agree with the car's condition at hand-over and starts your rental."
                : "Confirming means you agree with the car's condition at return and closes the rental. Your deposit is released after the dispute window unless the host reports damage."}{" "}
              If something is wrong, dispute it with a note — the rental
              still proceeds, and our team reviews your note.
            </p>

            {!disputing ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => confirm.mutate()}
                >
                  {confirm.isPending ? "Confirming…" : "Confirm the record"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDisputing(true)}
                >
                  Dispute
                </Button>
              </div>
            ) : (
              <form
                noValidate
                className="space-y-3"
                onSubmit={form.handleSubmit((values) => dispute.mutate(values))}
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`dispute-${inspection.id}`}>
                    What do you disagree with?
                  </Label>
                  <Textarea
                    id={`dispute-${inspection.id}`}
                    placeholder="e.g. The scratch on the rear bumper was already there at pickup."
                    maxLength={INSPECTION_DISPUTE_NOTE_MAX}
                    autoFocus
                    disabled={busy}
                    aria-invalid={!!form.formState.errors.note}
                    {...form.register("note")}
                  />
                  {form.formState.errors.note ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.note.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                  >
                    {dispute.isPending ? "Sending…" : "Send dispute"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      form.reset();
                      setDisputing(false);
                    }}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}

            {actionError ? (
              <p className="text-sm text-destructive" role="alert">
                {describeActionError(actionError)}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
