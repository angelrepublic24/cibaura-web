"use client";

import { ShieldCheck } from "lucide-react";
import { DepositStatusBadge } from "@/shared/components/claim-deposit-labels";
import type { BookingDetail, DepositDto } from "@/shared/types/domain";
import { formatDateTime } from "@/shared/utils/dates";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "success" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  info: "border-border bg-muted/60 text-muted-foreground",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

/** Agency-facing copy per deposit status (ADR-0013); amounts from the DTO. */
function describeDeposit(
  deposit: DepositDto,
  amount: string,
): { tone: Tone; title: string; body: string } {
  switch (deposit.status) {
    case "pending_hold":
      return {
        tone: "info",
        title: "Placing the hold",
        body: `The platform is placing a hold of ${amount} on the customer's card. The check-in can be submitted once it is held — this page updates automatically.`,
      };
    case "requires_action":
      return {
        tone: "warning",
        title: "The customer's bank needs a verification step",
        body: `The hold of ${amount} is waiting for the customer to complete a bank verification in their app. The check-in cannot be submitted until the hold is confirmed — ask them to finish it.`,
      };
    case "held":
      return {
        tone: "success",
        title: `${amount} is held on the customer's card`,
        body: `A hold, not a charge. It is released after check-out unless you flag damage${
          deposit.captureBefore
            ? `; the bank hold is valid until ${formatDateTime(deposit.captureBefore)} and is renewed automatically on the same card if the rental runs longer.`
            : "."
        }`,
      };
    case "reauthorizing":
      return {
        tone: "info",
        title: "Renewing the hold",
        body: `The bank's hold window is ending, so a fresh hold of ${amount} is being placed on the same card. No action is needed.`,
      };
    case "released":
      return {
        tone: "info",
        title: "Deposit released",
        body: `The hold of ${amount} was released to the customer — no damage was flagged, or no claim was filed within the dispute window.`,
      };
    case "captured":
      return {
        tone: "success",
        title: "Deposit captured for the approved claim",
        body: `${formatMoneyCents(deposit.capturedCents, deposit.currency)} of the ${amount} hold was captured and is credited to your wallet at settlement. Any remainder was released to the customer.`,
      };
    case "failed":
      return {
        tone: "danger",
        title: "The hold failed",
        body: `The customer's card declined the hold of ${amount}. They can place it again with another saved card from their booking page; the check-in cannot be submitted until a deposit is held.`,
      };
    case "lapsed":
      return {
        tone: "danger",
        title: "The hold expired",
        body: `The bank hold on ${amount} expired before it could be renewed. You can still file a damage claim within the dispute window, but collection is handled by our team off-platform.`,
      };
    case "waived":
      return {
        tone: "info",
        title: "No deposit on this booking",
        body: "Counter sales and cars without a deposit have nothing to hold.",
      };
    default:
      return {
        tone: "info",
        title: `Deposit status: ${deposit.status}`,
        body: `${amount} deposit on this booking.`,
      };
  }
}

/**
 * The security deposit as the HOST sees it (ADR-0013): the amount frozen on
 * the booking before check-in, then the server's hold status verbatim —
 * with what it means for the check-in, the claim and the payout. Nothing
 * here is derived; the customer's own card actions live on their side.
 */
export function DepositStatusCard({ booking }: { booking: BookingDetail }) {
  const deposit = booking.deposit;
  const currency = booking.pricing.currency;

  if (!deposit) {
    if (booking.depositCents === undefined) return null;
    const upcoming =
      booking.depositCents > 0 &&
      (booking.state === "requested" || booking.state === "accepted");
    if (!upcoming) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Security deposit
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A deposit of{" "}
          <span className="font-medium text-foreground">
            {formatMoneyCents(booking.depositCents, currency)}
          </span>{" "}
          is held on the customer&apos;s card when you start the check-in. It is
          released after check-out unless you flag damage and file a claim.
        </CardContent>
      </Card>
    );
  }

  const amount = formatMoneyCents(deposit.amountCents, deposit.currency);
  const copy = describeDeposit(deposit, amount);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Security deposit · {amount}
          </CardTitle>
          <DepositStatusBadge status={deposit.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn("rounded-[var(--radius-sm)] border p-4 text-sm", TONE_CLASS[copy.tone])}
          role="status"
        >
          <p className="font-semibold">{copy.title}</p>
          <p className="mt-1">{copy.body}</p>
        </div>
      </CardContent>
    </Card>
  );
}
