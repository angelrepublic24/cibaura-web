"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  ExternalLink,
  Gavel,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { AdminApi } from "@/features/admin/api";
import { InspectionBlock } from "@/features/admin/components/inspection-media-grid";
import { useBookingInspections } from "@/features/admin/hooks";
import { getErrorMessage } from "@/shared/api/errors";
import type {
  BookingAgreementDocumentDto,
  ClaimDto,
  DepositDto,
  InspectionDto,
  SettlementDto,
} from "@/shared/types/domain";
import {
  ClaimStatusBadge,
  DepositStatusBadge,
  InspectionStatusBadge,
} from "@/shared/components/claim-deposit-labels";
import {
  inspectionTypeLabel,
  settlementCaseLabel,
} from "@/shared/utils/lifecycle-labels";
import { useNow } from "@/shared/hooks/use-now";
import { useOpenSignedUrl } from "@/shared/hooks/use-open-signed-url";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { formatDateTime, formatRemaining } from "@/shared/utils/dates";
import { formatMoneyCents } from "@/shared/utils/money";

/**
 * Admin-side cards for the ADR-0011/0012/0013 lifecycle of an order:
 * deposit hold, damage claim, inspections (with evidence) and settlement.
 * Every amount is rendered verbatim from the DTOs — nothing is derived.
 */

/** Fallback for older payloads; current claim amounts carry the booking currency. */
export function claimCurrency(
  deposit: DepositDto | null,
  fallback = "USD",
): string {
  return deposit?.currency ?? fallback;
}

const DEPOSIT_STATUS_COPY: Record<string, string> = {
  pending_hold: "The hold has not been placed yet.",
  requires_action:
    "The customer must complete a bank verification (3-D Secure) before the hold is live.",
  held: "Funds are reserved on the customer's card and can be captured through an approved claim.",
  reauthorizing: "The hold is being renewed before it expires.",
  released: "The hold was voided — no money moved.",
  captured: "Captured through an approved damage claim.",
  lapsed:
    "The hold expired before it could be renewed. Claims can still be filed; collection is off-platform.",
  failed: "The card refused the hold. The customer can retry with another card.",
  waived: "No deposit applies to this booking.",
};

export function DepositCard({
  deposit,
  bookingDepositCents,
  currency,
}: {
  deposit?: DepositDto | null;
  bookingDepositCents?: number;
  currency: string;
}) {
  if (!deposit && bookingDepositCents === undefined) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Security deposit
          </CardTitle>
          {deposit ? <DepositStatusBadge status={deposit.status} /> : null}
        </div>
      </CardHeader>
      <CardContent>
        {!deposit ? (
          <p className="text-sm text-muted-foreground">
            {bookingDepositCents !== undefined && bookingDepositCents > 0
              ? `${formatMoneyCents(bookingDepositCents, currency)} will be held on the customer's card at check-in.`
              : "No deposit applies to this booking."}
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <Row label="Amount" value={formatMoneyCents(deposit.amountCents, deposit.currency)} />
              <Row
                label="Captured"
                value={
                  deposit.capturedCents > 0
                    ? formatMoneyCents(deposit.capturedCents, deposit.currency)
                    : "—"
                }
              />
              <Row label="Hold valid until" value={formatDateTime(deposit.captureBefore)} />
            </dl>
            <p className="text-muted-foreground">
              {DEPOSIT_STATUS_COPY[deposit.status] ?? ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimCard({
  claim,
  currency,
}: {
  claim?: ClaimDto | null;
  currency: string;
}) {
  if (claim === undefined) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4 text-primary" />
            Damage claim
          </CardTitle>
          {claim ? <ClaimStatusBadge status={claim.status} /> : null}
        </div>
      </CardHeader>
      <CardContent>
        {!claim ? (
          <p className="text-sm text-muted-foreground">No claim was filed.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <ClaimAmounts claim={claim} currency={claim.currency ?? currency} />
            <p className="line-clamp-3 text-muted-foreground">{claim.description}</p>
            <Link
              href={`/admin/claims/${claim.id}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open claim
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimAmounts({
  claim,
  currency,
}: {
  claim: ClaimDto;
  currency: string;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
      <Row label="Requested" value={formatMoneyCents(claim.requestedCents, currency)} />
      <Row
        label="Approved"
        value={
          claim.approvedCents !== null
            ? formatMoneyCents(claim.approvedCents, currency)
            : "—"
        }
      />
      <Row
        label="Captured"
        value={claim.capturedCents > 0 ? formatMoneyCents(claim.capturedCents, currency) : "—"}
      />
      <Row
        label="Uncollected"
        value={
          claim.uncollectedCents > 0
            ? formatMoneyCents(claim.uncollectedCents, currency)
            : "—"
        }
        alert={claim.uncollectedCents > 0}
      />
    </dl>
  );
}

/**
 * Inspections with media. The booking carries lightweight refs; the full
 * records (facts + signed media URLs) come from `GET /bookings/:id/inspections`
 * and are only fetched when at least one inspection exists.
 */
export function InspectionsCard({
  bookingId,
  refs = [],
}: {
  bookingId: string;
  refs?: { type: string; status: string; id: string }[];
}) {
  const query = useBookingInspections(bookingId, refs.length > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Inspections
        </CardTitle>
      </CardHeader>
      <CardContent>
        {refs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No check-in or check-out inspection yet.
          </p>
        ) : query.isLoading ? (
          <LoadingState label="Loading inspections…" className="py-6" />
        ) : query.isError ? (
          <div className="space-y-3">
            <ul className="flex flex-wrap gap-2">
              {refs.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span>{inspectionTypeLabel(r.type)}</span>
                  <InspectionStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
            <ErrorState
              title="Could not load the inspection media"
              message={getErrorMessage(query.error, "Please try again.")}
              onRetry={() => query.refetch()}
              className="py-6"
            />
          </div>
        ) : (
          <div className="space-y-6">
            {(query.data ?? []).map((i: InspectionDto) => (
              <InspectionBlock key={i.id} inspection={i} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SettlementCard({
  settlement,
  currency,
}: {
  settlement?: SettlementDto | null;
  currency: string;
}) {
  const now = useNow();
  if (settlement === undefined) return null;
  const windowEnds = settlement?.disputeWindowEndsAt
    ? new Date(settlement.disputeWindowEndsAt).getTime()
    : null;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            Settlement
          </CardTitle>
          {settlement ? (
            <Badge variant={settlement.status === "finalized" ? "success" : "warning"}>
              {settlement.status === "finalized" ? "Finalized" : "Pending"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {!settlement ? (
          <p className="text-sm text-muted-foreground">
            Not settled yet. The settlement is computed by the server once the
            booking is returned and the dispute window closes, or when it is
            cancelled.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <Row label="Case" value={settlementCaseLabel(settlement.case)} />
              <Row
                label="Dispute window ends"
                value={
                  windowEnds === null
                    ? "—"
                    : windowEnds > now
                      ? `${formatDateTime(settlement.disputeWindowEndsAt)} (in ${formatRemaining(windowEnds - now)})`
                      : formatDateTime(settlement.disputeWindowEndsAt)
                }
              />
              <Row label="Finalized" value={formatDateTime(settlement.finalizedAt)} />
            </dl>
            {settlement.breakdown.length > 0 ? (
              <dl className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
                {settlement.breakdown.map((line) => (
                  <div
                    key={`${line.code}-${line.label}`}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <dt className="text-foreground">{line.label}</dt>
                    <dd className="tabular-nums text-foreground">
                      {formatMoneyCents(line.amountCents, currency)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <Row label="Customer refund" value={formatMoneyCents(settlement.refundCents, currency)} />
              <Row label="Retention (host)" value={formatMoneyCents(settlement.retentionCents, currency)} />
              <Row
                label="Early-return refund"
                value={`${formatMoneyCents(settlement.earlyReturnRefundCents, currency)}${
                  settlement.unusedDays > 0
                    ? ` · ${settlement.unusedDays} unused day${settlement.unusedDays === 1 ? "" : "s"}`
                    : ""
                }`}
              />
              <Row label="Claim credited" value={formatMoneyCents(settlement.claimCents, currency)} />
              <Row label="Advance already paid" value={formatMoneyCents(settlement.advanceCents, currency)} />
              <Row label="Host net" value={formatMoneyCents(settlement.hostNetCents, currency)} strong />
              <Row label="Platform net" value={formatMoneyCents(settlement.platformNetCents, currency)} strong />
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** "Open PDF" for a signed contract document — the link is minted on click. */
export function ContractPdfButton({
  document,
  label = "Open signed PDF",
}: {
  document: BookingAgreementDocumentDto;
  label?: string;
}) {
  const pdf = useOpenSignedUrl(() => AdminApi.contractDocumentPdf(document.id));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pdf.isPending}
        onClick={pdf.open}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {pdf.isPending ? "Preparing PDF…" : label}
      </Button>
      {pdf.fallback ? (
        <a
          href={pdf.fallback.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline underline-offset-2"
        >
          Your browser blocked the tab — open the PDF here
        </a>
      ) : null}
      {pdf.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {getErrorMessage(pdf.error, "Could not prepare the PDF link.")}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  alert = false,
  strong = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          alert
            ? "font-medium text-red-700"
            : strong
              ? "font-semibold text-foreground"
              : "text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
