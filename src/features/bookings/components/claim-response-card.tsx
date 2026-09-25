"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Gavel } from "lucide-react";
import { BookingsApi } from "@/features/bookings/api";
import {
  invalidateBooking,
  useBookingInspections,
} from "@/features/bookings/hooks";
import { claimStatusMeta } from "@/features/bookings/labels";
import {
  CLAIM_NOTE_MAX,
  respondClaimSchema,
  type RespondClaimFormValues,
} from "@/features/bookings/schemas";
import { InspectionMediaGrid } from "@/features/bookings/components/inspection-media-viewer";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type { BookingDetail, ClaimDto } from "@/shared/types/domain";
import { useNow } from "@/shared/hooks/use-now";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatDateTime, formatRemaining } from "@/shared/utils/dates";
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
import { cn } from "@/lib/utils";

/** Copy for the respond-time codes (spec §0.2); anything else → server message. */
function describeRespondError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.CLAIM_NOT_OPEN:
      return "This claim is no longer open for a response. Refreshing…";
    case API_ERROR_CODES.CLAIM_RESPONSE_WINDOW_CLOSED:
      return "The response window has closed, so the claim went to admin review. You will be notified of the decision.";
    default:
      return getErrorMessage(
        error,
        "Your response could not be saved. Please try again.",
      );
  }
}

/**
 * Damage claim filed by the host after check-out (ADR-0013). While `open`
 * the customer has until `respondBy` to accept (the claim is approved at
 * the requested amount capped at the held deposit and captured) or reject
 * (an admin decides). Decided claims show the outcome verbatim. Evidence
 * media are the inspection files the host attached, shown through the
 * same signed-URL viewer as the inspections.
 */
export function ClaimResponseCard({ booking }: { booking: BookingDetail }) {
  const claim = booking.claim;
  const inspections = useBookingInspections(booking.id, !!claim);

  if (!claim) return null;

  const meta = claimStatusMeta(claim.status);
  const currency = claim.currency ?? booking.pricing.currency;
  const evidence = (inspections.data ?? [])
    .flatMap((i) => i.media)
    .filter((m) => claim.evidenceMediaIds.includes(m.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4" />
            Damage claim · {formatMoneyCents(claim.requestedCents, currency)}
          </CardTitle>
          <Badge variant={meta.tone}>{meta.label}</Badge>
        </div>
        <CardDescription>
          Filed by {booking.agency.name} on {formatDateTime(claim.createdAt)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            What the host reported
          </p>
          <p className="mt-1 whitespace-pre-line rounded-[var(--radius-sm)] bg-muted/60 p-3 leading-relaxed text-foreground">
            {claim.description}
          </p>
        </div>

        {claim.evidenceMediaIds.length > 0 ? (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Evidence ({claim.evidenceMediaIds.length})
            </p>
            {inspections.isLoading ? (
              <p className="text-muted-foreground">Loading evidence…</p>
            ) : inspections.isError ? (
              <div className="space-y-2">
                <p className="text-red-700">
                  {getErrorMessage(inspections.error, "Could not load the evidence.")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => inspections.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <InspectionMediaGrid
                media={evidence}
                emptyLabel="The referenced files are not available right now."
              />
            )}
          </div>
        ) : null}

        <ClaimAmounts booking={booking} claim={claim} />

        {claim.status === "open" ? (
          <RespondForm booking={booking} claim={claim} />
        ) : (
          <ClaimOutcome booking={booking} claim={claim} />
        )}
      </CardContent>
    </Card>
  );
}

/** The server's figures for this claim, verbatim. */
function ClaimAmounts({
  booking,
  claim,
}: {
  booking: BookingDetail;
  claim: ClaimDto;
}) {
  const currency = claim.currency ?? booking.pricing.currency;
  const deposit = booking.deposit;
  return (
    <dl className="space-y-1.5 rounded-[var(--radius-sm)] border border-border p-3">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Requested by the host</dt>
        <dd className="font-medium text-foreground">
          {formatMoneyCents(claim.requestedCents, currency)}
        </dd>
      </div>
      {deposit ? (
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Your deposit on hold</dt>
          <dd className="font-medium text-foreground">
            {formatMoneyCents(deposit.amountCents, deposit.currency)}
          </dd>
        </div>
      ) : null}
      {claim.approvedCents !== null ? (
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Approved</dt>
          <dd className="font-medium text-foreground">
            {formatMoneyCents(claim.approvedCents, currency)}
          </dd>
        </div>
      ) : null}
      {claim.capturedCents > 0 ? (
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Captured from your deposit</dt>
          <dd className="font-medium text-red-700">
            {formatMoneyCents(claim.capturedCents, currency)}
          </dd>
        </div>
      ) : null}
      {claim.uncollectedCents > 0 ? (
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Not collected</dt>
          <dd className="font-medium text-foreground">
            {formatMoneyCents(claim.uncollectedCents, currency)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function RespondForm({
  booking,
  claim,
}: {
  booking: BookingDetail;
  claim: ClaimDto;
}) {
  const qc = useQueryClient();
  const now = useNow();
  const deadline = new Date(claim.respondBy).getTime();
  const remaining = Number.isNaN(deadline) ? null : deadline - now;
  const overdue = remaining !== null && remaining <= 0;

  const form = useForm<RespondClaimFormValues>({
    resolver: zodResolver(respondClaimSchema),
    defaultValues: { note: "" },
  });
  const response = form.watch("response");

  const respond = useMutation({
    mutationFn: (values: RespondClaimFormValues) =>
      BookingsApi.respondClaim(booking.id, claim.id, {
        accept: values.response === "accept",
        note: values.note || undefined,
      }),
    onSuccess: () => invalidateBooking(qc, booking.id),
    onError: (error) => {
      const code = getApiErrorCode(error);
      if (
        code === API_ERROR_CODES.CLAIM_NOT_OPEN ||
        code === API_ERROR_CODES.CLAIM_RESPONSE_WINDOW_CLOSED
      ) {
        invalidateBooking(qc, booking.id);
      }
    },
  });

  return (
    <form
      noValidate
      className="space-y-4 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4"
      onSubmit={form.handleSubmit((values) => respond.mutate(values))}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-900">
          Your response is needed
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            overdue
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-amber-300 bg-white text-amber-900",
          )}
          title={`Respond by ${formatDateTime(claim.respondBy)}`}
        >
          <Clock className="h-3 w-3" />
          {remaining === null
            ? `Respond by ${formatDateTime(claim.respondBy)}`
            : overdue
              ? "Response window closed"
              : `${formatRemaining(remaining)} left to respond`}
        </span>
      </div>
      <p className="text-sm text-amber-900">
        If you do not respond by {formatDateTime(claim.respondBy)}, the claim
        goes to our team for a decision.
      </p>

      <fieldset className="space-y-2">
        <legend className="sr-only">Your response</legend>
        <label className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-border bg-white p-3 text-sm">
          <input
            type="radio"
            value="accept"
            className="mt-0.5 accent-primary"
            disabled={respond.isPending || overdue}
            {...form.register("response")}
          />
          <span>
            <span className="font-medium text-foreground">Accept the claim.</span>{" "}
            <span className="text-muted-foreground">
              The requested amount — capped at your deposit on hold — is
              captured from the deposit and paid to the host at settlement.
              Any remainder of the hold is released.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-border bg-white p-3 text-sm">
          <input
            type="radio"
            value="reject"
            className="mt-0.5 accent-primary"
            disabled={respond.isPending || overdue}
            {...form.register("response")}
          />
          <span>
            <span className="font-medium text-foreground">Reject the claim.</span>{" "}
            <span className="text-muted-foreground">
              Our team reviews the inspection records, your note and the
              host&apos;s evidence, then approves an amount (possibly zero) or
              rejects it. Your deposit stays on hold until then.
            </span>
          </span>
        </label>
        {form.formState.errors.response ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.response.message}
          </p>
        ) : null}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="claim-note">
          {response === "reject" ? "Why you disagree" : "Note (optional)"}
        </Label>
        <Textarea
          id="claim-note"
          placeholder={
            response === "reject"
              ? "Explain what you disagree with — this is what the admin reads."
              : "Anything the host or our team should know."
          }
          maxLength={CLAIM_NOTE_MAX}
          disabled={respond.isPending || overdue}
          aria-invalid={!!form.formState.errors.note}
          {...form.register("note")}
        />
        {form.formState.errors.note ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.note.message}
          </p>
        ) : null}
      </div>

      {respond.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {describeRespondError(respond.error)}
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        variant={response === "accept" ? "default" : "destructive"}
        disabled={respond.isPending || overdue}
      >
        {respond.isPending
          ? "Sending…"
          : response === "accept"
            ? "Accept and close the claim"
            : "Send my response"}
      </Button>
    </form>
  );
}

function ClaimOutcome({
  booking,
  claim,
}: {
  booking: BookingDetail;
  claim: ClaimDto;
}) {
  const currency = claim.currency ?? booking.pricing.currency;
  let tone = "border-border bg-muted/60 text-muted-foreground";
  let body: string;

  switch (claim.status) {
    case "under_review":
      body = claim.customerResponse === "rejected"
        ? "You rejected the claim; our team is reviewing it and will decide. You will be notified."
        : "The response window closed without an answer, so our team is reviewing the claim. You will be notified of the decision.";
      tone = "border-amber-200 bg-amber-50 text-amber-900";
      break;
    case "approved":
      body = `The claim was approved for ${formatMoneyCents(claim.approvedCents ?? claim.capturedCents, currency)}${claim.decidedAt ? ` on ${formatDateTime(claim.decidedAt)}` : ""}. ${claim.capturedCents > 0 ? `${formatMoneyCents(claim.capturedCents, currency)} was captured from your deposit; any remainder of the hold was released.` : "The amount is collected from your deposit."}`;
      tone = "border-red-200 bg-red-50 text-red-800";
      break;
    case "approved_uncollectible":
      body = `The claim was approved for ${formatMoneyCents(claim.approvedCents ?? 0, currency)}, but your deposit hold was no longer available to collect it. Our team will contact you about payment.`;
      tone = "border-red-200 bg-red-50 text-red-800";
      break;
    case "rejected":
      body = `The claim was rejected${claim.decidedAt ? ` on ${formatDateTime(claim.decidedAt)}` : ""}. Nothing is captured and your deposit hold is released.`;
      tone = "border-emerald-200 bg-emerald-50 text-emerald-800";
      break;
    case "withdrawn":
      body = "The host withdrew the claim. Nothing is captured and your deposit hold is released.";
      tone = "border-emerald-200 bg-emerald-50 text-emerald-800";
      break;
    default:
      body = `Claim status: ${claim.status}.`;
  }

  return (
    <div className={cn("space-y-1 rounded-[var(--radius-sm)] border p-3 text-sm", tone)}>
      <p>{body}</p>
      {claim.customerNote ? (
        <p className="text-xs">Your note: “{claim.customerNote}”</p>
      ) : null}
      {claim.decisionNote ? (
        <p className="text-xs">Decision note: “{claim.decisionNote}”</p>
      ) : null}
    </div>
  );
}
