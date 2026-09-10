"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  UserX,
} from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import {
  invalidateAgencyBooking,
  useAgencyInspections,
} from "@/features/agency/hooks";
import {
  CUSTOMER_ABSENT_REASON_MAX,
  CUSTOMER_ABSENT_REASON_MIN,
  FUEL_LEVEL_OPTIONS,
  INSPECTION_NOTES_MAX,
  ODOMETER_MAX_KM,
  inspectionDetailsSchema,
  type InspectionDetailsFormValues,
} from "@/features/agency/schemas";
import { REQUIRED_INSPECTION_LABELS } from "@/features/agency/inspection-media-upload";
import { useInspectionUploads } from "@/features/agency/use-inspection-uploads";
import { usePermission } from "@/features/agency/use-permission";
import {
  InspectionMediaUploader,
  requiredShotsUploaded,
} from "@/features/agency/components/inspection-media-uploader";
import { InspectionMediaGrid } from "@/features/bookings/components/inspection-media-viewer";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { InspectionStatusBadge } from "@/shared/components/claim-deposit-labels";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import type {
  BookingDetail,
  InspectionDto,
  InspectionType,
} from "@/shared/types/domain";
import {
  businessTodayIso,
  formatDateTime,
  formatIsoDate,
} from "@/shared/utils/dates";
import {
  fuelLevelText,
  inspectionTypeLabel,
} from "@/shared/utils/lifecycle-labels";
import { cn } from "@/lib/utils";

/**
 * Check-in / check-out for the HOST (ADR-0011) — replaces the one-click
 * pickup/return buttons. Per type: start a draft → record odometer, fuel,
 * damage → upload the guided shots → submit for the customer's
 * confirmation; while the customer is deciding the host may record them as
 * absent; finalized records are read-only with the customer's verdict (and
 * dispute note). The booking transitions (accepted → active, active →
 * returned) happen server-side when a record finalizes. The legacy
 * "mark without an inspection" path stays for counter sales and platforms
 * with inspections switched off — the server answers INSPECTION_REQUIRED
 * when it is not allowed.
 */
export function InspectionPanel({ booking }: { booking: BookingDetail }) {
  // `inspections` is required on the wire (spec §5) but absent from
  // pre-expansion backends — never let a missing array break the page.
  const refs = booking.inspections ?? [];
  const query = useAgencyInspections(booking.id, refs.length > 0);

  const showCheckin =
    booking.state === "accepted" ||
    booking.state === "active" ||
    booking.state === "returned" ||
    booking.state === "settled" ||
    refs.some((r) => r.type === "checkin");
  const showCheckout =
    booking.state === "active" ||
    booking.state === "returned" ||
    booking.state === "settled" ||
    refs.some((r) => r.type === "checkout");
  if (!showCheckin && !showCheckout) return null;

  if (refs.length > 0 && query.isLoading) {
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
  if (refs.length > 0 && query.isError) {
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

  const inspections = query.data ?? [];
  const find = (type: InspectionType) =>
    inspections.find((i) => i.type === type && i.status !== "void") ??
    inspections.find((i) => i.type === type) ??
    null;

  return (
    <>
      {showCheckin ? (
        <InspectionSection booking={booking} type="checkin" inspection={find("checkin")} />
      ) : null}
      {showCheckout ? (
        <InspectionSection booking={booking} type="checkout" inspection={find("checkout")} />
      ) : null}
    </>
  );
}

function InspectionSection({
  booking,
  type,
  inspection,
}: {
  booking: BookingDetail;
  type: InspectionType;
  inspection: InspectionDto | null;
}) {
  if (inspection) {
    return <InspectionRecord booking={booking} inspection={inspection} />;
  }
  const canStart =
    (type === "checkin" && booking.state === "accepted") ||
    (type === "checkout" && booking.state === "active");
  if (canStart) return <StartInspectionCard booking={booking} type={type} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          {inspectionTypeLabel(type)} inspection
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {type === "checkin"
          ? "No check-in record — the car was handed over without an inspection."
          : "No check-out record — the car was returned without an inspection."}
      </CardContent>
    </Card>
  );
}

/** Copy for the draft-creation codes (spec §0.2); anything else → server message. */
function describeCreateError(error: unknown, type: InspectionType): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.INSPECTION_EXISTS:
      return `A ${inspectionTypeLabel(type).toLowerCase()} record already exists for this booking. Refreshing…`;
    case API_ERROR_CODES.INSPECTION_WRONG_STATE:
      return type === "checkin"
        ? "Check-in can only start on or after the pickup day, while the booking is accepted."
        : "Check-out can only start while the rental is active.";
    default:
      return getErrorMessage(error, "Could not start the inspection. Please try again.");
  }
}

/** Copy for the legacy pickup/return codes. */
function describeLegacyError(error: unknown, type: InspectionType): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.INSPECTION_REQUIRED:
      return `This booking needs a ${inspectionTypeLabel(type).toLowerCase()} inspection before it can move on — start it above.`;
    default:
      return getErrorMessage(error, "Could not update the booking. Please try again.");
  }
}

/**
 * No record yet and the booking is in the right state: the primary CTA
 * opens the draft (check-in also places the deposit hold server-side);
 * the secondary, subdued path is the legacy transition without a record.
 */
function StartInspectionCard({
  booking,
  type,
}: {
  booking: BookingDetail;
  type: InspectionType;
}) {
  const qc = useQueryClient();
  const { can } = usePermission();
  const canHandle = can("bookings:handle");
  const [legacyConfirm, setLegacyConfirm] = useState(false);
  const label = inspectionTypeLabel(type);

  // Check-in opens on the pickup day (business calendar, like the server).
  const tooEarly = type === "checkin" && businessTodayIso() < booking.period.start;

  const create = useMutation({
    mutationFn: () => AgencyApi.createInspection(booking.id, { type }),
    onSuccess: (created) => {
      qc.setQueryData<InspectionDto[]>(agencyKeys.inspections(booking.id), (prev) => [
        ...(prev ?? []).filter((i) => i.id !== created.id),
        created,
      ]);
      invalidateAgencyBooking(qc, booking.id);
    },
    onError: (error) => {
      if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_EXISTS)) {
        invalidateAgencyBooking(qc, booking.id);
      }
    },
  });

  const legacy = useMutation({
    mutationFn: () =>
      type === "checkin"
        ? AgencyApi.pickupRequest(booking.id)
        : AgencyApi.returnRequest(booking.id),
    onSuccess: () => {
      setLegacyConfirm(false);
      invalidateAgencyBooking(qc, booking.id);
    },
  });

  const busy = create.isPending || legacy.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          {label} inspection
        </CardTitle>
        <CardDescription>
          {type === "checkin"
            ? "Record the car's condition with the customer before handing over the keys. Starting the check-in also places the security-deposit hold on their card; the rental becomes active once the customer confirms the record."
            : "Record the car's condition as it comes back. The rental closes and the dispute window starts once the customer confirms the record — or once you mark them absent."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canHandle ? (
          <p className="text-sm text-muted-foreground">
            You need the &quot;Accept / reject bookings&quot; permission to run inspections.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={busy || tooEarly}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Starting…" : `Start ${label.toLowerCase()}`}
              </Button>
              {tooEarly ? (
                <p className="text-sm text-muted-foreground">
                  Opens on the pickup day ({formatIsoDate(booking.period.start)}).
                </p>
              ) : null}
            </div>
            {create.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {describeCreateError(create.error, type)}
              </p>
            ) : null}

            <div className="border-t border-border pt-3">
              {legacyConfirm ? (
                <div className="space-y-2 rounded-[var(--radius-sm)] border border-border p-3">
                  <p className="text-sm text-muted-foreground">
                    {type === "checkin"
                      ? "Move the booking to active without a condition record. Only allowed for counter sales or when the platform does not require inspections — there will be no evidence for a damage claim."
                      : "Close the rental without a condition record. Only allowed for counter sales or when the platform does not require inspections — a damage claim will have no check-out evidence."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => legacy.mutate()}
                    >
                      {legacy.isPending
                        ? "Saving…"
                        : type === "checkin"
                          ? "Confirm — mark picked up"
                          : "Confirm — mark returned"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setLegacyConfirm(false)}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-muted-foreground"
                  disabled={busy}
                  onClick={() => setLegacyConfirm(true)}
                >
                  {type === "checkin"
                    ? "Mark picked up without an inspection"
                    : "Mark returned without an inspection"}
                </Button>
              )}
              {legacy.isError ? (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {describeLegacyError(legacy.error, type)}
                </p>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Copy for the submit-time codes (spec §0.2); anything else → server message. */
function describeSubmitError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.INSPECTION_INCOMPLETE:
      return "The record is incomplete — the platform needs the odometer, the fuel level and the minimum photos before it can be submitted.";
    case API_ERROR_CODES.MEDIA_NOT_UPLOADED:
      return "Some files are still pending or failed. Wait for the uploads to finish — or remove the failed ones — and submit again.";
    case API_ERROR_CODES.DEPOSIT_NOT_HELD:
      return "The security deposit is not held yet. The customer has to complete the deposit hold (see the deposit card) before the check-in can be submitted.";
    case API_ERROR_CODES.DEPOSIT_REQUIRES_ACTION:
      return "The customer's bank is asking for a verification step on the deposit. Ask them to complete it in the app, then submit again.";
    case API_ERROR_CODES.INSPECTION_WRONG_STATE:
      return "This record can no longer be submitted — the booking moved on. Refreshing…";
    default:
      return getErrorMessage(error, "Could not submit the record. Please try again.");
  }
}

function toFormValues(inspection: InspectionDto): InspectionDetailsFormValues {
  return {
    // NaN keeps the number field empty until the host types a reading.
    odometerKm: inspection.odometerKm ?? Number.NaN,
    fuelLevelEighths:
      inspection.fuelLevelEighths === null ? "" : String(inspection.fuelLevelEighths),
    damageFlagged: inspection.damageFlagged,
    damageNotes: inspection.damageNotes ?? "",
  };
}

function toUpdateInput(values: InspectionDetailsFormValues) {
  return {
    odometerKm: values.odometerKm,
    fuelLevelEighths: Number(values.fuelLevelEighths),
    damageFlagged: values.damageFlagged,
    damageNotes: values.damageNotes,
  };
}

/** One existing record: the draft editor, or the read-only facts + verdict. */
function InspectionRecord({
  booking,
  inspection,
}: {
  booking: BookingDetail;
  inspection: InspectionDto;
}) {
  const { can } = usePermission();
  const canHandle = can("bookings:handle");
  const label = inspectionTypeLabel(inspection.type);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            {label} inspection
          </CardTitle>
          <InspectionStatusBadge status={inspection.status} />
        </div>
        <CardDescription>
          {inspection.status === "draft"
            ? "Fill in the readings, upload the guided shots, then submit the record for the customer to confirm."
            : inspection.submittedAt
              ? `Submitted ${formatDateTime(inspection.submittedAt)}.`
              : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {inspection.status === "draft" && canHandle ? (
          <DraftEditor booking={booking} inspection={inspection} />
        ) : (
          <>
            <InspectionFacts inspection={inspection} />
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Photos and videos
              </p>
              <InspectionMediaGrid media={inspection.media} />
            </div>
            <InspectionVerdict booking={booking} inspection={inspection} canHandle={canHandle} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InspectionFacts({ inspection }: { inspection: InspectionDto }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact
          label="Odometer"
          value={
            inspection.odometerKm !== null
              ? `${inspection.odometerKm.toLocaleString("en-US")} km`
              : "Not recorded"
          }
        />
        <Fact label="Fuel level" value={fuelLevelText(inspection.fuelLevelEighths)} />
        <Fact
          label="Damage"
          value={inspection.damageFlagged ? "Flagged" : "None flagged"}
          alert={inspection.damageFlagged}
        />
      </dl>
      {inspection.damageNotes ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-line rounded-[var(--radius-sm)] bg-muted/60 p-3 leading-relaxed text-foreground">
            {inspection.damageNotes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-muted/60 p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-semibold",
          alert ? "inline-flex items-center gap-1 text-warning" : "text-foreground",
        )}
      >
        {alert ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
        {value}
      </dd>
    </div>
  );
}

/** Copy for the customer-absent codes. */
function describeAbsentError(error: unknown): string | undefined {
  if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_WRONG_STATE)) {
    return "The customer already answered this record — refresh the page to see their verdict.";
  }
  return undefined;
}

/** What happened after submission, plus the "customer absent" action while waiting. */
function InspectionVerdict({
  booking,
  inspection,
  canHandle,
}: {
  booking: BookingDetail;
  inspection: InspectionDto;
  canHandle: boolean;
}) {
  const qc = useQueryClient();
  const [absentOpen, setAbsentOpen] = useState(false);
  const isCheckin = inspection.type === "checkin";

  switch (inspection.status) {
    case "draft":
      return (
        <p className="text-sm text-muted-foreground">
          This draft is waiting for someone with the &quot;Accept / reject bookings&quot;
          permission to complete it.
        </p>
      );
    case "submitted":
      return (
        <div className="space-y-3 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            <span className="font-semibold">Waiting for the customer.</span>{" "}
            {isCheckin
              ? "They confirm the record in their app — the rental becomes active as soon as they do."
              : "They confirm the record in their app — the rental closes and the dispute window starts as soon as they do."}{" "}
            If they are not present or cannot respond, record them as absent to finalize
            without their confirmation.
          </p>
          {canHandle ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAbsentOpen(true)}
            >
              <UserX className="h-4 w-4" />
              Customer absent
            </Button>
          ) : null}
          <ReasonDialog
            open={absentOpen}
            onClose={() => setAbsentOpen(false)}
            title="Finalize without the customer?"
            description="The record is finalized as recorded by you, without the customer's confirmation, and the booking moves on. The customer is notified and keeps the right to dispute a damage claim."
            field={{
              label: "Why the customer could not confirm",
              placeholder: "e.g. The customer left before the walk-around was finished",
              hint: "Shown to the customer and to our team.",
              minLength: CUSTOMER_ABSENT_REASON_MIN,
              maxLength: CUSTOMER_ABSENT_REASON_MAX,
            }}
            confirmLabel="Finalize as customer absent"
            mapError={describeAbsentError}
            onConfirm={async (value) => {
              await AgencyApi.markCustomerAbsent(inspection.id, value ?? "");
              invalidateAgencyBooking(qc, booking.id);
            }}
          />
        </div>
      );
    case "confirmed":
      return (
        <p className="rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Confirmed by the customer on {formatDateTime(inspection.customerConfirmedAt)}.
        </p>
      );
    case "confirmed_absent":
      return (
        <p className="rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          Finalized without the customer
          {inspection.customerAbsentReason ? `: “${inspection.customerAbsentReason}”` : ""}
          {inspection.finalizedAt ? ` (${formatDateTime(inspection.finalizedAt)})` : ""}.
        </p>
      );
    case "disputed":
      return (
        <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">The customer disputed this record.</p>
          {inspection.customerDisputeNote ? (
            <p className="mt-1 whitespace-pre-line">“{inspection.customerDisputeNote}”</p>
          ) : null}
          <p className="mt-1 text-xs text-red-700">
            The booking still moved on. Our team was alerted and weighs the note in any damage
            claim on this booking.
          </p>
        </div>
      );
    case "void":
      return (
        <p className="text-sm text-muted-foreground">
          This record was voided when the booking was cancelled.
        </p>
      );
    default:
      return null;
  }
}

/**
 * The editable draft: readings form + media uploader + submit. "Save
 * details" persists the readings alone; "Submit" validates, saves any
 * unsaved change, then hands the record to the customer.
 */
function DraftEditor({
  booking,
  inspection,
}: {
  booking: BookingDetail;
  inspection: InspectionDto;
}) {
  const qc = useQueryClient();
  const uploads = useInspectionUploads(booking.id, inspection);
  const isCheckin = inspection.type === "checkin";

  const form = useForm<InspectionDetailsFormValues>({
    resolver: zodResolver(inspectionDetailsSchema),
    defaultValues: toFormValues(inspection),
  });
  const damageFlagged = form.watch("damageFlagged");

  const cacheUpdated = (updated: InspectionDto) => {
    qc.setQueryData<InspectionDto[]>(agencyKeys.inspections(booking.id), (prev) =>
      prev?.map((i) => (i.id === updated.id ? { ...updated, media: i.media } : i)),
    );
  };

  const save = useMutation({
    mutationFn: (values: InspectionDetailsFormValues) =>
      AgencyApi.updateInspection(inspection.id, toUpdateInput(values)),
    onSuccess: (updated) => {
      cacheUpdated(updated);
      form.reset(toFormValues(updated));
    },
  });

  const submit = useMutation({
    mutationFn: async (values: InspectionDetailsFormValues) => {
      if (form.formState.isDirty) {
        const saved = await AgencyApi.updateInspection(inspection.id, toUpdateInput(values));
        cacheUpdated(saved);
        form.reset(toFormValues(saved));
      }
      return AgencyApi.submitInspection(inspection.id);
    },
    onSuccess: (submitted) => {
      qc.setQueryData<InspectionDto[]>(agencyKeys.inspections(booking.id), (prev) =>
        prev?.map((i) => (i.id === submitted.id ? submitted : i)),
      );
      invalidateAgencyBooking(qc, booking.id);
    },
    onError: (error) => {
      if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_WRONG_STATE)) {
        invalidateAgencyBooking(qc, booking.id);
      }
    },
  });

  const busy = save.isPending || submit.isPending;
  const uploadedShots = requiredShotsUploaded(inspection.media);
  const shotsReady = uploadedShots === REQUIRED_INSPECTION_LABELS.length;
  const readingsSaved =
    inspection.odometerKm !== null && inspection.fuelLevelEighths !== null;
  const depositBlocking =
    isCheckin &&
    booking.deposit !== null &&
    booking.deposit.status !== "held" &&
    booking.deposit.status !== "waived";
  const canSubmit = shotsReady && !uploads.inFlight && !busy;

  const fieldError = (name: keyof InspectionDetailsFormValues) =>
    form.formState.errors[name]?.message;

  return (
    <div className="space-y-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`odometer-${inspection.id}`}>Odometer (km)</Label>
            <Input
              id={`odometer-${inspection.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={ODOMETER_MAX_KM}
              step={1}
              placeholder="e.g. 48210"
              disabled={busy}
              aria-invalid={!!fieldError("odometerKm")}
              {...form.register("odometerKm", { valueAsNumber: true })}
            />
            {fieldError("odometerKm") ? (
              <p className="text-sm text-destructive">{fieldError("odometerKm")}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`fuel-${inspection.id}`}>Fuel level</Label>
            <Select
              id={`fuel-${inspection.id}`}
              disabled={busy}
              aria-invalid={!!fieldError("fuelLevelEighths")}
              {...form.register("fuelLevelEighths")}
            >
              <option value="">Choose…</option>
              {FUEL_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {fieldError("fuelLevelEighths") ? (
              <p className="text-sm text-destructive">{fieldError("fuelLevelEighths")}</p>
            ) : null}
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            disabled={busy}
            {...form.register("damageFlagged")}
          />
          <span>
            <span className="font-medium text-foreground">
              {isCheckin
                ? "The car has pre-existing damage"
                : "The car came back with new damage"}
            </span>
            <span className="block text-muted-foreground">
              {isCheckin
                ? "Note every existing mark now — the customer is not liable for what is recorded here."
                : "Flagging keeps the customer's deposit on hold so you can file a claim during the dispute window."}
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          <Label htmlFor={`notes-${inspection.id}`}>
            {damageFlagged ? "Damage notes" : "Notes (optional)"}
          </Label>
          <Textarea
            id={`notes-${inspection.id}`}
            placeholder={
              damageFlagged
                ? "Where, what and how big — e.g. 10 cm scratch on the rear bumper, left side."
                : "Anything worth recording about the car's condition."
            }
            maxLength={INSPECTION_NOTES_MAX}
            disabled={busy}
            aria-invalid={!!fieldError("damageNotes")}
            {...form.register("damageNotes")}
          />
          {fieldError("damageNotes") ? (
            <p className="text-sm text-destructive">{fieldError("damageNotes")}</p>
          ) : null}
        </div>

        {save.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {getErrorMessage(save.error, "Could not save the readings. Please try again.")}
          </p>
        ) : null}

        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={busy || !form.formState.isDirty}
        >
          {save.isPending ? "Saving…" : "Save details"}
        </Button>
      </form>

      <InspectionMediaUploader inspection={inspection} uploads={uploads} disabled={busy} />

      <div className="space-y-3 rounded-[var(--radius-sm)] border border-border bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">Ready to submit?</p>
        <ul className="space-y-1 text-sm">
          <Check done={readingsSaved || form.formState.isDirty}>
            Odometer and fuel level recorded
            {!readingsSaved && form.formState.isDirty ? " (saved on submit)" : ""}
          </Check>
          <Check done={shotsReady}>
            Required shots uploaded ({uploadedShots}/{REQUIRED_INSPECTION_LABELS.length})
          </Check>
          <Check done={!uploads.inFlight}>
            {uploads.inFlight ? "Uploads still in progress" : "All uploads finished"}
          </Check>
          {isCheckin ? (
            <Check done={!depositBlocking}>
              {depositBlocking
                ? "Security deposit not held yet — see the deposit card"
                : "Security deposit in place"}
            </Check>
          ) : null}
        </ul>
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => form.handleSubmit((values) => submit.mutate(values))()}
        >
          {submit.isPending ? "Submitting…" : "Submit for customer confirmation"}
        </Button>
        {submit.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeSubmitError(submit.error)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          The customer gets a notification to confirm or dispute the record.
          {isCheckin
            ? " The rental becomes active when they confirm (or when you mark them absent)."
            : " The rental closes when they confirm (or when you mark them absent), and the dispute window starts."}
        </p>
      </div>
    </div>
  );
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-start gap-2", done ? "text-foreground" : "text-muted-foreground")}>
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}
