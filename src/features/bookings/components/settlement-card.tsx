"use client";

import { Clock, Receipt } from "lucide-react";
import { settlementCaseLabel } from "@/shared/utils/lifecycle-labels";
import type { BookingDetail, SettlementDto } from "@/shared/types/domain";
import { useNow } from "@/shared/hooks/use-now";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatDateTime, formatRemaining } from "@/shared/utils/dates";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * How the money of a closed (or closing) booking was resolved (ADR-0012):
 * the server's settlement case, its breakdown lines and the refund /
 * retention / claim figures — rendered verbatim (invariant #9: clients
 * never compute refunds). Before a settlement row exists on a returned
 * booking it explains the dispute window instead.
 */
export function SettlementCard({ booking }: { booking: BookingDetail }) {
  const settlement = booking.settlement;

  if (!settlement) {
    if (booking.state !== "returned") return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Settlement
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The car is back. {booking.agency.name} has a short dispute window to
          report damage; once it closes without a claim, your deposit hold is
          released and the booking settles automatically. Any refund due —
          for example after an early return — appears here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Settlement
          </CardTitle>
          <Badge variant={settlement.status === "finalized" ? "success" : "warning"}>
            {settlement.status === "finalized" ? "Finalized" : "Pending"}
          </Badge>
        </div>
        <CardDescription>{settlementCaseLabel(settlement.case)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <SettlementTiming settlement={settlement} />

        {settlement.breakdown.length > 0 ? (
          <dl className="space-y-1 rounded-[var(--radius-sm)] border border-border p-3">
            {settlement.breakdown.map((line, i) => (
              <div key={`${line.code}-${i}`} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="font-medium text-foreground">
                  {formatMoneyCents(line.amountCents, booking.pricing.currency)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <RefundSummary booking={booking} settlement={settlement} />
      </CardContent>
    </Card>
  );
}

function SettlementTiming({ settlement }: { settlement: SettlementDto }) {
  const now = useNow();
  if (settlement.status === "finalized") {
    return settlement.finalizedAt ? (
      <p className="text-xs text-muted-foreground">
        Finalized on {formatDateTime(settlement.finalizedAt)}.
      </p>
    ) : null;
  }
  if (!settlement.disputeWindowEndsAt) return null;
  const ends = new Date(settlement.disputeWindowEndsAt).getTime();
  const remaining = Number.isNaN(ends) ? null : ends - now;
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3 text-muted-foreground">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
      <span>
        {remaining !== null && remaining > 0
          ? `The dispute window closes in ${formatRemaining(remaining)} (${formatDateTime(settlement.disputeWindowEndsAt)}). The booking settles automatically afterwards unless a damage claim is open.`
          : `The dispute window closed on ${formatDateTime(settlement.disputeWindowEndsAt)}; the settlement is being finalized.`}
      </span>
    </p>
  );
}

/** The refund / retention story for the customer, from the server's figures. */
function RefundSummary({
  booking,
  settlement,
}: {
  booking: BookingDetail;
  settlement: SettlementDto;
}) {
  const currency = booking.pricing.currency;
  const refund = formatMoneyCents(settlement.refundCents, currency);

  let explanation: string;
  switch (settlement.case) {
    case "completed":
      explanation =
        settlement.refundCents > 0
          ? "The rental completed; the amount below is returned to your card."
          : "The rental completed as booked — no refund is due.";
      break;
    case "early_return":
      explanation = `You returned the car early: ${settlement.unusedDays} unused day${settlement.unusedDays === 1 ? "" : "s"}, minus the early-return penalty, are refunded. Delivery fees are not refundable.`;
      break;
    case "cancelled_free":
      explanation =
        "Cancelled within the free window — the full amount goes back to your card.";
      break;
    case "cancelled_late":
      explanation = `Late cancellation: ${formatMoneyCents(settlement.retentionCents, currency)} was retained by the host under the cancellation policy and the rest is refunded.`;
      break;
    case "cancelled_by_host":
      explanation =
        "The host cancelled this booking — the full amount is refunded to your card.";
      break;
    case "cancelled_mid_rental":
      explanation =
        "The booking was cancelled during the rental; the refund below was decided by our team.";
      break;
    case "cancelled_requested":
      explanation =
        "Cancelled before the host accepted: the card hold was released and nothing was charged.";
      break;
    default:
      explanation = "Refund and retention as computed by the platform.";
  }

  return (
    <div className="space-y-2">
      <dl className="space-y-1.5 rounded-[var(--radius-sm)] bg-muted/60 p-3">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Refunded to your card</dt>
          <dd className="text-lg font-semibold text-foreground">{refund}</dd>
        </div>
        {settlement.retentionCents > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Retained by {booking.agency.name}</dt>
            <dd className="font-medium text-red-700">
              {formatMoneyCents(settlement.retentionCents, currency)}
            </dd>
          </div>
        ) : null}
        {settlement.earlyReturnRefundCents > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Early-return refund ({settlement.unusedDays} unused day
              {settlement.unusedDays === 1 ? "" : "s"})
            </dt>
            <dd className="font-medium text-foreground">
              {formatMoneyCents(settlement.earlyReturnRefundCents, currency)}
            </dd>
          </div>
        ) : null}
        {settlement.claimCents > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Damage claim captured from your deposit
            </dt>
            <dd className="font-medium text-red-700">
              {formatMoneyCents(settlement.claimCents, currency)}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="text-xs text-muted-foreground">
        {explanation}
        {settlement.refundCents > 0
          ? " Refunds go back to the original card within a few business days."
          : ""}
      </p>
    </div>
  );
}
