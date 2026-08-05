"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, CalendarRange, MapPin } from "lucide-react";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import { ChatPanel } from "@/features/bookings/components/chat-panel";
import type { Booking } from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";
import { formatIsoDate } from "@/shared/utils/dates";

/**
 * /admin/orders/[id] — platform-admin order (booking) detail. Read-only
 * oversight: the full booking + its chat (the ChatPanel renders in OBSERVER
 * mode for a platform_admin — they can read the thread but never post). Data
 * comes from the existing GET /bookings/:id + /messages/bookings/:id, both of
 * which the backend grants a platform_admin for oversight.
 */
export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => BookingsApi.findById(id),
    enabled: !!id,
  });

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div className="space-y-6">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>

        {query.isPending ? (
          <LoadingState label="Loading order…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load this order"
            message={(query.error as Error).message}
            onRetry={() => query.refetch()}
          />
        ) : (
          <OrderDetail booking={query.data} />
        )}
      </div>
    </RoleGuard>
  );
}

function OrderDetail({ booking }: { booking: Booking }) {
  const p = booking.pricing;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-foreground">
              {booking.car.make} {booking.car.model} {booking.car.year}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                {booking.agency.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4 text-primary" />
                {formatIsoDate(booking.period.start)} →{" "}
                {formatIsoDate(booking.period.end)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                {booking.pickup.type === "delivery"
                  ? booking.pickup.deliveryAddress
                    ? `Delivery: ${booking.pickup.deliveryAddress}`
                    : `Delivery: ${booking.pickup.deliveryZoneName ?? "zone"}`
                  : "Branch pickup"}
              </span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Order {booking.id}
            </p>
          </div>
          <BookingStateBadge state={booking.state} />
        </div>

        {/* Pricing breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>
                  {p.days} day{p.days === 1 ? "" : "s"} ×{" "}
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
                <dt>Platform commission ({formatPct(p.commissionPct)})</dt>
                <dd>{formatMoneyCents(p.commissionCents, p.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <dt>Customer total</dt>
                <dd>{formatMoneyCents(p.totalCents, p.currency)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1.5 text-sm">
              <TimeRow label="Requested" iso={booking.timestamps.requestedAt} />
              <TimeRow label="Accepted" iso={booking.timestamps.acceptedAt} />
              <TimeRow label="Picked up" iso={booking.timestamps.pickedUpAt} />
              <TimeRow label="Returned" iso={booking.timestamps.returnedAt} />
              <TimeRow label="Settled" iso={booking.timestamps.settledAt} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Oversight chat (read-only for admins) */}
      <ChatPanel booking={booking} />
    </div>
  );
}

function TimeRow({ label, iso }: { label: string; iso: string | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">
        {iso ? new Date(iso).toLocaleString() : "—"}
      </dd>
    </div>
  );
}
