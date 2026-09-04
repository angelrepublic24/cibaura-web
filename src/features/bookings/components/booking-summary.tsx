"use client";

import { Check } from "lucide-react";
import {
  BOOKING_HAPPY_PATH,
  BOOKING_TERMINAL_STATES,
  type Booking,
} from "@/shared/types/domain";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Role-agnostic booking summary cards, shared by the CUSTOMER detail
 * (/account/bookings/[id]) and the AGENCY detail (/agency/requests/[id]).
 * Anything role-specific (cancel, review, lifecycle actions) stays in the
 * respective detail component.
 */

/** Happy-path timeline with the current state highlighted; terminal
 *  branches (rejected/expired/cancelled) render as a banner instead. */
export function StateTimeline({ booking }: { booking: Booking }) {
  const isTerminal = BOOKING_TERMINAL_STATES.includes(booking.state);
  const currentIdx = BOOKING_HAPPY_PATH.indexOf(booking.state);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Booking progress</CardTitle>
      </CardHeader>
      <CardContent>
        {isTerminal ? (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            This booking ended as <strong>{booking.state}</strong>
            {booking.stateReason ? ` — ${booking.stateReason}` : ""}.
          </div>
        ) : (
          <ol className="flex flex-wrap items-center gap-2">
            {BOOKING_HAPPY_PATH.map((state, i) => {
              const done = i < currentIdx;
              const current = i === currentIdx;
              return (
                <li key={state} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && "border-primary text-primary",
                      !done && !current && "border-border text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-sm capitalize",
                      current ? "font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {state}
                  </span>
                  {i < BOOKING_HAPPY_PATH.length - 1 ? (
                    <span className="mx-1 h-px w-6 bg-border" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Frozen server-side pricing snapshot, rendered verbatim. */
export function PricingCard({ booking }: { booking: Booking }) {
  const p = booking.pricing;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Price breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>
              {p.days} day{p.days === 1 ? "" : "s"} x{" "}
              {formatMoneyCents(p.ratePerDayCents, p.currency)}
            </dt>
            <dd>{formatMoneyCents(p.subtotalCents, p.currency)}</dd>
          </div>
          {p.deliveryFeeCents > 0 ? (
            <div className="flex justify-between">
              <dt>Delivery fee</dt>
              <dd>{formatMoneyCents(p.deliveryFeeCents, p.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-muted-foreground">
            <dt>Service fee ({formatPct(p.commissionPct)})</dt>
            <dd>{formatMoneyCents(p.commissionCents, p.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{formatMoneyCents(p.totalCents, p.currency)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Snapshot frozen at request time — computed by the server.
        </p>
      </CardContent>
    </Card>
  );
}
