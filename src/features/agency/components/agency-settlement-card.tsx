"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Receipt } from "lucide-react";
import { AgencyApi } from "@/features/agency/api";
import { invalidateAgencyBooking } from "@/features/agency/hooks";
import { usePermission } from "@/features/agency/use-permission";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useNow } from "@/shared/hooks/use-now";
import type { BookingDetail, SettlementDto } from "@/shared/types/domain";
import { formatDateTime, formatRemaining } from "@/shared/utils/dates";
import { settlementCaseLabel } from "@/shared/utils/lifecycle-labels";
import { formatMoneyCents } from "@/shared/utils/money";
import { cn } from "@/lib/utils";

/** Copy for the settle-time codes (spec §0.2); anything else → server message. */
function describeSettleError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.DISPUTE_WINDOW_OPEN:
      return "The dispute window is still open — settlement becomes available once it closes.";
    case API_ERROR_CODES.CLAIM_OPEN:
      return "A damage claim is still open. It has to be decided or withdrawn before the booking can settle.";
    case API_ERROR_CODES.SETTLEMENT_ALREADY_FINALIZED:
      return "This booking was already settled. Refreshing…";
    default:
      return getErrorMessage(error, "Could not settle the booking. Please try again.");
  }
}

/**
 * Settlement for the HOST (ADR-0012): on a returned booking, the dispute
 * window countdown and a "Settle now" that the server only accepts once the
 * window closed and no claim is open (the button mirrors that, the server
 * decides); once a settlement row exists, its case, breakdown lines and the
 * host/platform/refund figures — verbatim (invariant #9: clients never
 * compute settlements).
 */
export function AgencySettlementCard({ booking }: { booking: BookingDetail }) {
  const settlement = booking.settlement;
  const finalized = settlement?.status === "finalized";

  if (booking.state === "returned" && !finalized) {
    return <PendingSettlement booking={booking} settlement={settlement} />;
  }
  if (settlement) return <FinalizedSettlement booking={booking} settlement={settlement} />;
  if (booking.state === "settled") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            Settlement
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Settled on {formatDateTime(booking.timestamps.settledAt)} — your earnings were
          credited to the wallet.
        </CardContent>
      </Card>
    );
  }
  return null;
}

function PendingSettlement({
  booking,
  settlement,
}: {
  booking: BookingDetail;
  settlement?: SettlementDto | null;
}) {
  const qc = useQueryClient();
  const now = useNow();
  const { can } = usePermission();
  const canHandle = can("bookings:handle");

  const endsAt = settlement?.disputeWindowEndsAt ?? null;
  const ends = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  const windowKnown = !Number.isNaN(ends);
  const windowOpen = windowKnown && ends > now;
  const claimBlocking =
    booking.claim?.status === "open" || booking.claim?.status === "under_review";

  const settle = useMutation({
    mutationFn: () => AgencyApi.settleRequest(booking.id),
    onSuccess: () => invalidateAgencyBooking(qc, booking.id),
    onError: (error) => {
      if (isApiErrorCode(error, API_ERROR_CODES.SETTLEMENT_ALREADY_FINALIZED)) {
        invalidateAgencyBooking(qc, booking.id);
      }
    },
  });

  const canSettle = canHandle && !windowOpen && !claimBlocking && !settle.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            Settlement
          </CardTitle>
          <Badge variant="warning">Pending</Badge>
        </div>
        <CardDescription>
          The car is back. Earnings are released to your wallet once the dispute window closes
          with no open claim — automatically, or sooner by settling here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3 text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
          <span>
            {windowOpen
              ? `Dispute window closes in ${formatRemaining(ends - now)} (${formatDateTime(endsAt)}). File any damage claim before then.`
              : windowKnown
                ? `The dispute window closed on ${formatDateTime(endsAt)}.`
                : "The dispute window length is set by the platform; settlement is accepted once it has closed."}
          </span>
        </p>

        {claimBlocking ? (
          <p className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-amber-900">
            A damage claim is open — the booking settles once it is decided or withdrawn.
          </p>
        ) : null}

        {canHandle ? (
          <div className="space-y-2">
            <Button type="button" disabled={!canSettle} onClick={() => settle.mutate()}>
              {settle.isPending ? "Settling…" : "Settle now"}
            </Button>
            {settle.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {describeSettleError(settle.error)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Settling credits your net earnings (and any captured claim) to the wallet and
              refunds the customer whatever the policy owes them — for example after an early
              return.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FinalizedSettlement({
  booking,
  settlement,
}: {
  booking: BookingDetail;
  settlement: SettlementDto;
}) {
  const currency = booking.pricing.currency;
  const money = (cents: number) => formatMoneyCents(cents, currency);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            Settlement
          </CardTitle>
          <Badge variant={settlement.status === "finalized" ? "success" : "warning"}>
            {settlement.status === "finalized" ? "Finalized" : "Pending"}
          </Badge>
        </div>
        <CardDescription>
          {settlementCaseLabel(settlement.case)}
          {settlement.finalizedAt ? ` · finalized ${formatDateTime(settlement.finalizedAt)}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {settlement.breakdown.length > 0 ? (
          <dl className="space-y-1 rounded-[var(--radius-sm)] border border-border p-3">
            {settlement.breakdown.map((line, i) => (
              <div key={`${line.code}-${i}`} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="font-medium text-foreground">{money(line.amountCents)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <dl className="space-y-1.5 rounded-[var(--radius-sm)] bg-muted/60 p-3">
          <Line label="Credited to your wallet" value={money(settlement.hostNetCents)} strong />
          {settlement.claimCents > 0 ? (
            <Line label="Damage claim captured for you" value={money(settlement.claimCents)} />
          ) : null}
          {settlement.retentionCents > 0 ? (
            <Line label="Late-cancellation retention" value={money(settlement.retentionCents)} />
          ) : null}
          {settlement.advanceCents > 0 ? (
            <Line
              label="Already advanced at check-in"
              value={`− ${money(settlement.advanceCents)}`}
              muted
            />
          ) : null}
          {settlement.refundCents > 0 ? (
            <Line
              label={
                settlement.case === "early_return"
                  ? `Refunded to the customer (${settlement.unusedDays} unused day${settlement.unusedDays === 1 ? "" : "s"})`
                  : "Refunded to the customer"
              }
              value={money(settlement.refundCents)}
              muted
            />
          ) : null}
          <Line label="Platform fee" value={money(settlement.platformNetCents)} muted />
        </dl>
      </CardContent>
    </Card>
  );
}

function Line({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          strong ? "text-lg font-semibold text-foreground" : "font-medium",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
