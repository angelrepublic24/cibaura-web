"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  CreditCard,
  MapPin,
} from "lucide-react";
import { AdminApi, adminKeys, type AdminBookingDetail } from "@/features/admin/api";
import {
  ClaimCard,
  ContractPdfButton,
  DepositCard,
  InspectionsCard,
  SettlementCard,
} from "@/features/admin/components/order-lifecycle-cards";
import { bookingKeys } from "@/features/bookings/api";
import { ChatPanel } from "@/features/bookings/components/chat-panel";
import {
  AgreementCard,
  CustomerCard,
} from "@/features/agency/components/booking-parties";
import { RoleGuard } from "@/shared/auth/guard";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";
import { closedBookingReason } from "@/shared/utils/booking-reasons";
import { formatIsoDate } from "@/shared/utils/dates";

/**
 * /admin/orders/[id] — platform-admin order (booking) detail from
 * GET /admin/bookings/:id: the agency-viewer booking (customer identity +
 * rental agreement, never a client secret) plus the payment's lifecycle
 * status, the read-only oversight chat, and the one intervention an admin
 * has — cancelling on behalf of the platform with a reason (the customer is
 * refunded in full). The v1-expansion blocks (deposit, claim, inspections
 * with evidence, settlement) render verbatim from the DTO.
 */

const CANCELLABLE_STATES = new Set(["requested", "accepted", "active"]);

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  authorized: "Authorized (hold placed)",
  requires_action: "Awaiting bank verification",
  failed: "Authorization failed",
  captured: "Captured",
  voided: "Hold released",
  refunded: "Refunded",
  capture_failed: "Capture failed",
};

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: adminKeys.booking(id),
    queryFn: () => AdminApi.getBooking(id),
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
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : (
          <OrderDetail booking={query.data} />
        )}
      </div>
    </RoleGuard>
  );
}

function OrderDetail({ booking }: { booking: AdminBookingDetail }) {
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const p = booking.pricing;
  const reason = closedBookingReason(booking);
  const cancellable = CANCELLABLE_STATES.has(booking.state);

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
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-primary" />
                {booking.paymentStatus
                  ? (PAYMENT_STATUS_LABELS[booking.paymentStatus] ??
                    booking.paymentStatus)
                  : "No card payment (counter sale)"}
              </span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Order {booking.id}
            </p>
          </div>
          <BookingStateBadge state={booking.state} />
        </div>

        {reason ? (
          <div
            className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
            role="status"
          >
            <span className="font-medium">
              {booking.state === "rejected" ? "Rejected" : "Cancelled"}:
            </span>{" "}
            {reason}
          </div>
        ) : null}

        {/* Platform intervention */}
        {cancellable ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform intervention</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Cancel this booking on behalf of the platform. The customer is
                refunded in full and both parties are notified.
              </p>
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {booking.customer ? <CustomerCard customer={booking.customer} /> : null}

        <AgreementCard agreement={booking.agreement} />
        {booking.agreement?.document ? (
          <div className="-mt-3 flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
            <span>
              Signed document v{booking.agreement.document.templateVersion} ·{" "}
              {booking.agreement.document.countersignedAt
                ? "countersigned by the host"
                : "awaiting the host's countersignature"}
            </span>
            <ContractPdfButton document={booking.agreement.document} />
          </div>
        ) : null}

        <DepositCard
          deposit={booking.deposit}
          bookingDepositCents={booking.depositCents}
          currency={p.currency}
        />
        <ClaimCard
          claim={booking.claim}
          currency={booking.deposit?.currency ?? p.currency}
        />
        <InspectionsCard bookingId={booking.id} refs={booking.inspections} />
        <SettlementCard settlement={booking.settlement} currency={p.currency} />

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
            {booking.pickup.branchAddress ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Pickup at {booking.pickup.branchAddress}
                {booking.pickup.branchPhone ? ` · ${booking.pickup.branchPhone}` : ""}
              </p>
            ) : null}
            {booking.pickup.type === "delivery" && booking.pickup.deliveryFeeCents > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <Badge variant="secondary">Delivery</Badge>{" "}
                {booking.pickup.deliveryDistanceKm
                  ? `${booking.pickup.deliveryDistanceKm} km`
                  : booking.pickup.deliveryZoneName}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Oversight chat (read-only for admins) */}
      <ChatPanel booking={booking} />

      <ReasonDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={
          booking.state === "active"
            ? "Cancel this rental mid-way?"
            : "Cancel this booking?"
        }
        description="The customer will be refunded in full. Both the customer and the agency are notified with your reason."
        field={{
          label: "Reason",
          placeholder: "e.g. Agency confirmed the car is not roadworthy",
          hint: "Shown to both parties.",
          // Backend reuses `CancelBookingDto` (2..160) — the dialog defaults.
        }}
        confirmLabel="Cancel booking"
        destructive
        onConfirm={async (value) => {
          await AdminApi.cancelBooking(booking.id, value ?? "");
          qc.invalidateQueries({ queryKey: adminKeys.booking(booking.id) });
          qc.invalidateQueries({ queryKey: adminKeys.bookings() });
          qc.invalidateQueries({ queryKey: adminKeys.overview() });
          qc.invalidateQueries({ queryKey: bookingKeys.detail(booking.id) });
        }}
      />
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
