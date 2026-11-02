"use client";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { useAgencyBookingDetail } from "@/modules/agency/hooks/agency.hook";

import { ChatPanel } from "@/modules/bookings/components/chat-panel";
import {
  PricingCard,
  StateTimeline,
} from "@/modules/bookings/components/booking-summary";
import {
  AgencySettlementCard,
} from "@/modules/agency/components/agency-settlement-card";
import {
  BookingLifecycleActions,
} from "@/modules/agency/components/booking-lifecycle-actions";
import { AgreementCard } from "@/modules/agency/components/booking-parties";
import { ClaimCard } from "@/modules/agency/components/claim-card";
import {
  DepositStatusCard,
} from "@/modules/agency/components/deposit-status-card";
import {
  HandoverCodeEntry,
} from "@/modules/agency/components/handover-code-entry";
import { InspectionPanel } from "@/modules/agency/components/inspection-panel";
import {
  RenterDocumentsNotice,
} from "@/modules/agency/components/renter-documents-notice";
import {
  RenterIdentityCard,
} from "@/modules/agency/components/renter-identity-card";
import { PersonModerationActions } from "@/modules/moderation/components/moderation-actions";
import { useAuthStore } from "@/shared/auth/store";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import type { BookingDetail, BookingState } from "@/shared/types/domain";
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
 * mounts the host operations: accept / reject / cancel, the renter-documents
 * nudge, the check-in and check-out inspections that move the booking
 * (ADR-0011), the security deposit and damage-claim cards (ADR-0013), the
 * settlement card (ADR-0012), and what only the agency viewer gets — the
 * renter's identity and the frozen rental agreement. No customer-only
 * surface here (no payment, no review).
 */
export function AgencyBookingDetail({ bookingId }: { bookingId: string }) {
  const query = useAgencyBookingDetail(bookingId);

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

          {/* Above the identity card on purpose: what the renter still owes
              is what decides whether this booking can move at all, and the
              host reads it before the papers they do have. */}
          <RenterDocumentsNotice booking={booking} />

          <RenterIdentityCard booking={booking} />

          <RenterModerationSection booking={booking} />

          {/* Above the inspection: the host asks for the code first, and
              without it nothing below can move the booking anyway. */}
          <HandoverCodeEntry booking={booking} />

          <InspectionPanel booking={booking} />

          <DepositStatusCard booking={booking} />

          <ClaimCard booking={booking} />

          <AgencySettlementCard booking={booking} />

          <AgreementCard agreement={booking.agreement} />

          <PricingCard booking={booking} viewer="host" />
        </div>

        <ChatPanel booking={booking} />
      </div>
    </div>
  );
}

/**
 * Report or block THE RENTER — the host's side of moderation.
 *
 * GATED BY ROLE, not by permission. The backend authorises these routes with
 * `@Auth(customer, agency_owner, agency_staff)`, so the role is the real
 * gate; the `reports:view` permission that exists in this app is about
 * BUSINESS reports (revenue, bookings) and has nothing to do with filing a
 * moderation report. Using `PermissionGate` here would hide the action from
 * staff the backend happily serves, and tie two unrelated concepts together.
 *
 * TWO ROLES, TWO GATES, because the backend has two: reporting is open to the
 * whole agency side, while BLOCKING A PERSON is the OWNER's alone (403
 * `MODERATION_BLOCK_OWNER_ONLY`). Refusing a customer binds the agency, and
 * the booking gate can only see the owner's row — so a staff member's block
 * would be a button that returns 201 and changes nothing. The Expo app gates
 * the same action to the owner; these two clients must not disagree about
 * what the API does.
 *
 * `booking.customer` only travels to the agency and admin viewers, and even
 * then the wire type allows it to be absent — so this renders nothing rather
 * than inventing a name or an id.
 */
function RenterModerationSection({ booking }: { booking: BookingDetail }) {
  const user = useAuthStore((s) => s.user);
  const isOwner = !!user && user.roles.includes("agency_owner");
  const isHost = isOwner || (!!user && user.roles.includes("agency_staff"));

  const customer = booking.customer;
  if (!isHost || !customer) return null;

  return (
    <PersonModerationActions
      userId={customer.id}
      userName={customer.name}
      canBlock={isOwner}
      title={isOwner ? "Report or block this renter" : "Report this renter"}
      description={
        <>
          For behaviour our team should see — anything said in the chat
          included.{" "}
          {isOwner ? (
            <>
              Blocking stops new bookings between you and {customer.name},
              quietly:{" "}
            </>
          ) : (
            <>
              Reporting reaches our team, who can act on the account; only the
              agency owner can block a renter. Either way,{" "}
            </>
          )}
          <span className="font-medium text-foreground">
            this booking is not affected
          </span>{" "}
          and nothing is cancelled or refunded.
        </>
      }
    />
  );
}
