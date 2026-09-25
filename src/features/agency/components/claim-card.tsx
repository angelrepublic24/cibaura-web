"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Gavel, ImageOff } from "lucide-react";
import { AgencyApi } from "@/features/agency/api";
import {
  invalidateAgencyBooking,
  useAgencyClaims,
  useAgencyInspections,
} from "@/features/agency/hooks";
import {
  CLAIM_DESCRIPTION_MAX,
  CLAIM_EVIDENCE_MAX,
  buildFileClaimSchema,
  type FileClaimFormValues,
} from "@/features/agency/schemas";
import { usePermission } from "@/features/agency/use-permission";
import { InspectionMediaGrid } from "@/features/bookings/components/inspection-media-viewer";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { ClaimStatusBadge } from "@/shared/components/claim-deposit-labels";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { useNow } from "@/shared/hooks/use-now";
import type {
  BookingDetail,
  ClaimDto,
  InspectionDto,
  InspectionMediaDto,
} from "@/shared/types/domain";
import { formatDateTime, formatRemaining } from "@/shared/utils/dates";
import {
  inspectionTypeLabel,
  mediaLabelText,
} from "@/shared/utils/lifecycle-labels";
import { formatMoneyCents, wholeUnitsToCents } from "@/shared/utils/money";
import { cn } from "@/lib/utils";

/** Spec §4/B9: the claim ceiling when no deposit was held (cents). */
const NO_DEPOSIT_CLAIM_CAP_CENTS = 500_000;

function isOpenClaim(claim: ClaimDto | null): boolean {
  return claim?.status === "open" || claim?.status === "under_review";
}

/**
 * Damage claims for the HOST (ADR-0013). On a returned booking with no open
 * claim and the dispute window still open, the host can file one against
 * the deposit (amount, description, evidence picked from the check-in /
 * check-out media). An existing claim shows its status, the customer's
 * response and countdown, the decision, and a withdraw action while it is
 * `open | under_review`. Amounts are the server's; nothing is derived.
 */
export function ClaimCard({ booking }: { booking: BookingDetail }) {
  const { can } = usePermission();
  const canHandle = can("bookings:handle");
  const claim = booking.claim;
  const relevant = booking.state === "returned" || claim != null;
  const history = useAgencyClaims(booking.id, relevant);
  const inspections = useAgencyInspections(
    booking.id,
    relevant && (booking.inspections ?? []).length > 0,
  );

  if (!relevant) return null;

  const currency = booking.pricing.currency;
  const earlier = (history.data ?? []).filter((c) => c.id !== claim?.id);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4 text-primary" />
            Damage claim
            {claim ? ` · ${formatMoneyCents(claim.requestedCents, currency)}` : ""}
          </CardTitle>
          {claim ? <ClaimStatusBadge status={claim.status} /> : null}
        </div>
        {claim ? (
          <CardDescription>Filed {formatDateTime(claim.createdAt)}.</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {claim ? (
          <ClaimStatus
            booking={booking}
            claim={claim}
            inspections={inspections.data ?? []}
            canHandle={canHandle}
          />
        ) : canHandle ? (
          <FileClaimSection booking={booking} inspections={inspections} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No damage claim has been filed. Someone with the &quot;Accept / reject
            bookings&quot; permission can file one during the dispute window.
          </p>
        )}

        {earlier.length > 0 ? (
          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Earlier claims
            </p>
            <ul className="space-y-1 text-sm">
              {earlier.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {formatMoneyCents(c.requestedCents, currency)} · {formatDateTime(c.createdAt)}
                  </span>
                  <ClaimStatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Copy for the withdraw-time codes. */
function describeWithdrawError(error: unknown): string {
  if (isApiErrorCode(error, API_ERROR_CODES.CLAIM_NOT_OPEN)) {
    return "This claim was already decided. Refreshing…";
  }
  return getErrorMessage(error, "Could not withdraw the claim. Please try again.");
}

function ClaimStatus({
  booking,
  claim,
  inspections,
  canHandle,
}: {
  booking: BookingDetail;
  claim: ClaimDto;
  inspections: InspectionDto[];
  canHandle: boolean;
}) {
  const qc = useQueryClient();
  const now = useNow();
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const currency = booking.pricing.currency;
  const evidence = inspections
    .flatMap((i) => i.media)
    .filter((m) => claim.evidenceMediaIds.includes(m.id));

  const withdraw = useMutation({
    mutationFn: () => AgencyApi.withdrawClaim(claim.id),
    onSuccess: () => {
      setWithdrawConfirm(false);
      invalidateAgencyBooking(qc, booking.id);
    },
    onError: (error) => {
      if (isApiErrorCode(error, API_ERROR_CODES.CLAIM_NOT_OPEN)) {
        invalidateAgencyBooking(qc, booking.id);
      }
    },
  });

  const deadline = new Date(claim.respondBy).getTime();
  const remaining = Number.isNaN(deadline) ? null : deadline - now;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Your description</p>
        <p className="mt-1 whitespace-pre-line rounded-[var(--radius-sm)] bg-muted/60 p-3 leading-relaxed text-foreground">
          {claim.description}
        </p>
      </div>

      {claim.evidenceMediaIds.length > 0 ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Evidence ({claim.evidenceMediaIds.length})
          </p>
          <InspectionMediaGrid
            media={evidence}
            emptyLabel="The referenced files are not available right now."
          />
        </div>
      ) : null}

      <dl className="space-y-1.5 rounded-[var(--radius-sm)] border border-border p-3">
        <Amount label="Requested" value={formatMoneyCents(claim.requestedCents, currency)} />
        {booking.deposit ? (
          <Amount
            label="Deposit on hold"
            value={formatMoneyCents(booking.deposit.amountCents, booking.deposit.currency)}
          />
        ) : null}
        {claim.approvedCents !== null ? (
          <Amount label="Approved" value={formatMoneyCents(claim.approvedCents, currency)} />
        ) : null}
        {claim.capturedCents > 0 ? (
          <Amount
            label="Captured from the deposit"
            value={formatMoneyCents(claim.capturedCents, currency)}
            strong
          />
        ) : null}
        {claim.uncollectedCents > 0 ? (
          <Amount
            label="Not collectible on the platform"
            value={formatMoneyCents(claim.uncollectedCents, currency)}
          />
        ) : null}
      </dl>

      <ClaimOutcome claim={claim} remaining={remaining} currency={currency} />

      {canHandle && isOpenClaim(claim) ? (
        <div className="space-y-2">
          {withdrawConfirm ? (
            <div className="space-y-2 rounded-[var(--radius-sm)] border border-border p-3">
              <p className="text-muted-foreground">
                Withdrawing closes the claim for good: the deposit hold is released to the
                customer and the booking settles without a claim amount.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate()}
                >
                  {withdraw.isPending ? "Withdrawing…" : "Confirm — withdraw the claim"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={withdraw.isPending}
                  onClick={() => setWithdrawConfirm(false)}
                >
                  Keep the claim
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setWithdrawConfirm(true)}
            >
              Withdraw the claim
            </Button>
          )}
          {withdraw.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {describeWithdrawError(withdraw.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Amount({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", strong ? "text-success" : "text-foreground")}>{value}</dd>
    </div>
  );
}

function ClaimOutcome({
  claim,
  remaining,
  currency,
}: {
  claim: ClaimDto;
  remaining: number | null;
  currency: string;
}) {
  let tone = "border-border bg-muted/60 text-muted-foreground";
  let body: React.ReactNode;

  switch (claim.status) {
    case "open": {
      const overdue = remaining !== null && remaining <= 0;
      tone = "border-amber-200 bg-amber-50 text-amber-900";
      body = (
        <>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              overdue
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-amber-300 bg-white text-amber-900",
            )}
            title={`Customer must respond by ${formatDateTime(claim.respondBy)}`}
          >
            <Clock className="h-3 w-3" />
            {remaining === null
              ? `Customer responds by ${formatDateTime(claim.respondBy)}`
              : overdue
                ? "Response window closed"
                : `${formatRemaining(remaining)} left for the customer`}
          </span>
          <p className="mt-2">
            {overdue
              ? "The customer did not respond in time; the claim goes to our team for a decision."
              : `Waiting for the customer. If they accept, the amount (capped at the deposit on hold) is captured right away; if they reject or do not answer by ${formatDateTime(claim.respondBy)}, our team decides.`}
          </p>
        </>
      );
      break;
    }
    case "under_review":
      tone = "border-accent-soft bg-accent-soft/40 text-foreground";
      body = (
        <p>
          {claim.customerResponse === "rejected"
            ? "The customer rejected the claim. Our team is reviewing the inspection records, your evidence and their note, and will approve an amount (possibly zero) or reject it."
            : "The customer did not respond in time. Our team is reviewing the claim and will decide."}
        </p>
      );
      break;
    case "approved":
      tone = "border-emerald-200 bg-emerald-50 text-emerald-800";
      body = (
        <p>
          Approved for {formatMoneyCents(claim.approvedCents ?? claim.capturedCents, currency)}
          {claim.decidedAt ? ` on ${formatDateTime(claim.decidedAt)}` : ""}.{" "}
          {claim.capturedCents > 0
            ? `${formatMoneyCents(claim.capturedCents, currency)} was captured from the deposit and is credited to your wallet at settlement.`
            : "The amount is being captured from the deposit."}
        </p>
      );
      break;
    case "approved_uncollectible":
      tone = "border-red-200 bg-red-50 text-red-800";
      body = (
        <p>
          Approved for {formatMoneyCents(claim.approvedCents ?? 0, currency)}, but the deposit
          hold was no longer available to collect it. Our team handles the collection with the
          customer off-platform.
        </p>
      );
      break;
    case "rejected":
      tone = "border-red-200 bg-red-50 text-red-800";
      body = (
        <p>
          Rejected{claim.decidedAt ? ` on ${formatDateTime(claim.decidedAt)}` : ""}. Nothing is
          captured; the deposit hold is released to the customer.
        </p>
      );
      break;
    case "withdrawn":
      body = <p>You withdrew this claim. The deposit hold was released to the customer.</p>;
      break;
    default:
      body = <p>Claim status: {claim.status}.</p>;
  }

  return (
    <div className={cn("space-y-1 rounded-[var(--radius-sm)] border p-3 text-sm", tone)}>
      {body}
      {claim.customerNote ? (
        <p className="text-xs">Customer&apos;s note: “{claim.customerNote}”</p>
      ) : null}
      {claim.decisionNote ? (
        <p className="text-xs">Decision note: “{claim.decisionNote}”</p>
      ) : null}
    </div>
  );
}

/** Copy for the filing-time codes (spec §0.2); anything else → server message. */
function describeFileError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.DISPUTE_WINDOW_CLOSED:
      return "The dispute window has closed — claims can no longer be filed for this booking.";
    case API_ERROR_CODES.CLAIM_EXISTS:
      return "A claim is already open for this booking. Refreshing…";
    case API_ERROR_CODES.CLAIM_AMOUNT_EXCEEDS_LIMIT:
      return "The amount exceeds the limit for this booking's deposit.";
    default:
      return getErrorMessage(error, "Could not file the claim. Please try again.");
  }
}

/**
 * The filing entry point: a collapsed prompt while the window is open, the
 * form once the host opts in, or the "window closed" note when the server's
 * `disputeWindowEndsAt` has passed (the server re-checks on submit).
 */
function FileClaimSection({
  booking,
  inspections,
}: {
  booking: BookingDetail;
  inspections: ReturnType<typeof useAgencyInspections>;
}) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  const endsAt = booking.settlement?.disputeWindowEndsAt ?? null;
  const ends = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  const closed = !Number.isNaN(ends) && ends <= now;

  if (closed) {
    return (
      <p className="text-sm text-muted-foreground">
        The dispute window closed on {formatDateTime(endsAt)} — claims can no longer be filed
        for this booking.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Found damage at check-out? File a claim against the customer&apos;s deposit
          {!Number.isNaN(ends)
            ? ` before the dispute window closes (${formatRemaining(ends - now)} left, ${formatDateTime(endsAt)})`
            : " before the dispute window closes"}
          . The customer can accept it — the amount is captured right away — or reject it, in
          which case our team decides from the inspection records and your evidence.
        </p>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Gavel className="h-4 w-4" />
          File a damage claim
        </Button>
      </div>
    );
  }

  return (
    <FileClaimForm booking={booking} inspections={inspections} onCancel={() => setOpen(false)} />
  );
}

function FileClaimForm({
  booking,
  inspections,
  onCancel,
}: {
  booking: BookingDetail;
  inspections: ReturnType<typeof useAgencyInspections>;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const deposit = booking.deposit;
  const currency = deposit?.currency ?? booking.pricing.currency;
  const hasDeposit = deposit != null && deposit.amountCents > 0 && deposit.status !== "waived";
  const maxCents = hasDeposit ? deposit.amountCents : NO_DEPOSIT_CLAIM_CAP_CENTS;
  const maxLabel = formatMoneyCents(maxCents, currency);

  const form = useForm<FileClaimFormValues>({
    resolver: zodResolver(buildFileClaimSchema(maxCents, maxLabel)),
    defaultValues: { amount: Number.NaN, description: "", evidenceMediaIds: [] },
  });
  const evidence = form.watch("evidenceMediaIds");

  const file = useMutation({
    mutationFn: (values: FileClaimFormValues) =>
      AgencyApi.fileClaim(booking.id, {
        requestedCents: wholeUnitsToCents(values.amount),
        description: values.description,
        evidenceMediaIds: values.evidenceMediaIds,
      }),
    onSuccess: () => invalidateAgencyBooking(qc, booking.id),
    onError: (error) => {
      if (isApiErrorCode(error, API_ERROR_CODES.CLAIM_EXISTS)) {
        invalidateAgencyBooking(qc, booking.id);
      }
    },
  });

  const toggleEvidence = (id: string) => {
    const next = evidence.includes(id)
      ? evidence.filter((e) => e !== id)
      : [...evidence, id];
    form.setValue("evidenceMediaIds", next, { shouldValidate: true, shouldDirty: true });
  };

  const errors = form.formState.errors;
  const busy = file.isPending;

  return (
    <form
      noValidate
      className="space-y-4 rounded-[var(--radius-sm)] border border-border p-4"
      onSubmit={form.handleSubmit((values) => file.mutate(values))}
    >
      <div className="space-y-1.5">
        <Label htmlFor="claim-amount">Amount claimed ({currency})</Label>
        <Input
          id="claim-amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="e.g. 150.00"
          disabled={busy}
          aria-invalid={!!errors.amount}
          {...form.register("amount", { valueAsNumber: true })}
        />
        {errors.amount ? (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {hasDeposit
              ? `Up to the deposit on hold (${maxLabel}). If the customer accepts, this amount is captured from it.`
              : `No deposit is held for this booking (cap ${maxLabel}) — an approved amount is collected by our team off-platform.`}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="claim-description">What happened</Label>
        <Textarea
          id="claim-description"
          placeholder="Describe the damage, where it is and how you priced the repair. The customer and our team read this."
          maxLength={CLAIM_DESCRIPTION_MAX}
          className="min-h-[120px]"
          disabled={busy}
          aria-invalid={!!errors.description}
          {...form.register("description")}
        />
        {errors.description ? (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Evidence · {evidence.length}/{CLAIM_EVIDENCE_MAX}
        </p>
        <EvidencePicker
          inspections={inspections}
          selected={evidence}
          onToggle={toggleEvidence}
          disabled={busy}
          full={evidence.length >= CLAIM_EVIDENCE_MAX}
        />
        {errors.evidenceMediaIds ? (
          <p className="text-sm text-destructive">{errors.evidenceMediaIds.message}</p>
        ) : null}
      </div>

      {file.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {describeFileError(file.error)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Filing…" : "File the claim"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Check-in / check-out media as selectable evidence tiles. */
function EvidencePicker({
  inspections,
  selected,
  onToggle,
  disabled,
  full,
}: {
  inspections: ReturnType<typeof useAgencyInspections>;
  selected: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
  full: boolean;
}) {
  if (inspections.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading inspection files…</p>;
  }
  if (inspections.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-700">
          {getErrorMessage(inspections.error, "Could not load the inspection files.")}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => inspections.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const groups = (inspections.data ?? [])
    .map((i) => ({
      inspection: i,
      media: [...i.media]
        .filter((m) => m.status === "uploaded")
        .sort((a, b) => a.position - b.position),
    }))
    .filter((g) => g.media.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No inspection photos or videos are available for this booking. You can still file the
        claim from the description alone.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(({ inspection, media }) => (
        <div key={inspection.id} className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {inspectionTypeLabel(inspection.type)} · {media.length} file
            {media.length === 1 ? "" : "s"}
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {media.map((m) => (
              <li key={m.id}>
                <EvidenceTile
                  media={m}
                  checked={selected.includes(m.id)}
                  disabled={disabled || (full && !selected.includes(m.id))}
                  onToggle={() => onToggle(m.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EvidenceTile({
  media,
  checked,
  disabled,
  onToggle,
}: {
  media: InspectionMediaDto;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <label
      className={cn(
        "relative block aspect-square cursor-pointer overflow-hidden rounded-[var(--radius-sm)] border bg-muted",
        checked ? "border-primary ring-2 ring-primary/30" : "border-border",
        disabled && !checked && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        className="absolute left-1.5 top-1.5 z-10 h-4 w-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        aria-label={`${mediaLabelText(media.label)} ${media.kind}`}
      />
      {!media.url || broken ? (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-5 w-5" />
        </span>
      ) : media.kind === "video" ? (
        <video
          src={media.url}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL
        <img
          src={media.url}
          alt={mediaLabelText(media.label)}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-navy/60 px-1.5 py-0.5 text-[11px] text-cream">
        {mediaLabelText(media.label)}
      </span>
    </label>
  );
}
