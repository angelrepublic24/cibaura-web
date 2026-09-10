"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import { ChatPanel } from "@/features/bookings/components/chat-panel";
import {
  PricingCard,
  StateTimeline,
} from "@/features/bookings/components/booking-summary";
import { BookingLifecycleActions } from "@/features/agency/components/booking-lifecycle-actions";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { formatIsoDate } from "@/shared/utils/dates";
import { ErrorState, LoadingState } from "@/shared/components/states";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * AGENCY-side booking detail (/agency/requests/[bookingId]) — staff stay in
 * the dashboard chrome instead of being routed through the customer account
 * shell. Reuses the shared summary cards + per-booking chat (the backend
 * grants `GET /bookings/:id` and the thread to the managing agency), and
 * mounts the lifecycle actions (accept/reject → pickup → return → settle).
 * No customer-only surface here (no cancel, no review).
 */
export function AgencyBookingDetail({ bookingId }: { bookingId: string }) {
  const query = useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => BookingsApi.findById(bookingId),
  });

  if (query.isLoading) return <LoadingState label="Loading booking…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load this booking"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const booking = query.data!;

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
            <CardContent>
              <BookingLifecycleActions booking={booking} />
              {booking.state === "settled" ? (
                <p className="text-sm text-muted-foreground">
                  Settled — the payout is in your wallet. Nothing left to do.
                </p>
              ) : null}
              {booking.state === "rejected" ||
              booking.state === "expired" ||
              booking.state === "cancelled" ? (
                <p className="text-sm text-muted-foreground">
                  This booking is closed ({booking.state}) — no further actions.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <PricingCard booking={booking} />
        </div>

        <ChatPanel booking={booking} />
      </div>
    </div>
  );
}
