"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AgencyApi } from "@/features/agency/api";
import { bookingKeys } from "@/features/bookings/api";
import { ChatPanel } from "@/features/bookings/components/chat-panel";
import {
  PricingCard,
  StateTimeline,
} from "@/features/bookings/components/booking-summary";
import { AgencySettlementCard } from "@/features/agency/components/agency-settlement-card";
import { BookingLifecycleActions } from "@/features/agency/components/booking-lifecycle-actions";
import { AgreementCard } from "@/features/agency/components/booking-parties";
import { ClaimCard } from "@/features/agency/components/claim-card";
import { DepositStatusCard } from "@/features/agency/components/deposit-status-card";
import { InspectionPanel } from "@/features/agency/components/inspection-panel";
import { RenterIdentityCard } from "@/features/agency/components/renter-identity-card";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import type { BookingState } from "@/shared/types/domain";
import { formatIsoDate } from "@/shared/utils/dates";
import { ErrorState, LoadingState } from "@/shared/components/states";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * What the "Manage this booking" card says next to the lifecycle actions:
 * where the next step happens now that pickup, return and settlement run
 * through the inspection / settlement cards (ADR-0011 / ADR-0012) instead
 * of one-click buttons.
 */
const LIFECYCLE_NOTES: Partial<Record<BookingState, string>> = {
  accepted:
    "Hand-over runs through the check-in inspection below — the rental becomes active once the record is confirmed.",
  active:
    "Return runs through the check-out inspection below — the rental closes once the record is confirmed.",
  returned:
    "The car is back. File any damage claim during the dispute window; the booking settles from the settlement card below.",
  settled: "Settled — the payout is in your wallet. Nothing left to do.",
  rejected: "This booking is closed (rejected) — no further actions.",
  expired: "This booking is closed (expired) — no further actions.",
  cancelled: "This booking is closed (cancelled) — no further actions.",
};

/**
 * AGENCY-side booking detail (/agency/requests/[bookingId]) — staff stay in
 * the dashboard chrome instead of being routed through the customer account
 * shell. Reuses the shared summary cards + per-booking chat (the backend
 * grants `GET /bookings/:id` and the thread to the managing agency) and
 * mounts the host operations: accept / reject / cancel, the check-in and
 * check-out inspections that move the booking (ADR-0011), the security
 * deposit and damage-claim cards (ADR-0013), the settlement card (ADR-0012),
 * and what only the agency viewer gets — the renter's identity and the
 * frozen rental agreement. No customer-only surface here (no payment, no
 * review).
 */
export function AgencyBookingDetail({ bookingId }: { bookingId: string }) {
  const query = useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => AgencyApi.bookingDetail(bookingId),
  });

  if (query.isPending) return <LoadingState label="Loading booking…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load this booking"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const booking = query.data;
  const note = LIFECYCLE_NOTES[booking.state];

  return (
    <div className="space-y-6">
      <Link
        href="/agency/requests"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to requests
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {booking.car.make} {booking.car.model} {booking.car.year}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formatIsoDate(booking.period.start)} →{" "}
                {formatIsoDate(booking.period.end)} · Branch:{" "}
                {booking.branch.name}
              </p>
              {booking.pickup.type === "delivery" ? (
                <p className="text-sm font-medium text-foreground">
                  Deliver to:{" "}
                  {booking.pickup.deliveryAddress ??
                    booking.pickup.deliveryZoneName ??
                    "delivery zone"}
                  {booking.pickup.deliveryReference
                    ? ` (${booking.pickup.deliveryReference})`
                    : ""}
                </p>
              ) : (
                <p className="text-sm font-medium text-foreground">
                  Branch pickup
                </p>
              )}
            </div>
            <BookingStateBadge state={booking.state} />
          </div>

          <StateTimeline booking={booking} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage this booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BookingLifecycleActions booking={booking} />
              {note ? (
                <p className="text-sm text-muted-foreground">{note}</p>
              ) : null}
            </CardContent>
          </Card>

          <RenterIdentityCard booking={booking} />

          <InspectionPanel booking={booking} />

          <DepositStatusCard booking={booking} />

          <ClaimCard booking={booking} />

          <AgencySettlementCard booking={booking} />

          <AgreementCard agreement={booking.agreement} />

          <PricingCard booking={booking} />
        </div>

        <ChatPanel booking={booking} />
      </div>
    </div>
  );
}
