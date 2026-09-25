"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin, Phone, XCircle } from "lucide-react";
import { bookingKeys } from "@/features/bookings/api";
import { useBookingDetail } from "@/features/bookings/hooks";
import { AgreementCard } from "@/features/bookings/components/agreement-card";
import { ChatPanel } from "@/features/bookings/components/chat-panel";
import { CancelBookingDialog } from "@/features/bookings/components/cancel-booking-dialog";
import { ClaimResponseCard } from "@/features/bookings/components/claim-response-card";
import { DepositBanner } from "@/features/bookings/components/deposit-banner";
import { InspectionsSection } from "@/features/bookings/components/inspections-section";
import { SettlementCard } from "@/features/bookings/components/settlement-card";
import {
  PricingCard,
  StateTimeline,
} from "@/features/bookings/components/booking-summary";
import { useRequestPayment } from "@/features/bookings/use-request-payment";
import { AgenciesApi, agencyProfileKeys } from "@/features/agencies/api";
import { useLegalCurrent } from "@/features/legal/hooks";
import { formatDays } from "@/features/legal/components/cancellation-policy";
import {
  BOOKING_TERMINAL_STATES,
  type Booking,
  type BookingDetail as BookingDetailData,
} from "@/shared/types/domain";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { StarPicker, StarRating } from "@/shared/components/star-rating";
import { formatDateTime, formatIsoDate } from "@/shared/utils/dates";
import { closedBookingReason } from "@/shared/utils/booking-reasons";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Textarea } from "@/shared/components/ui/textarea";

export function BookingDetail({ bookingId }: { bookingId: string }) {
  const query = useBookingDetail(bookingId);

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
  const isTerminal = BOOKING_TERMINAL_STATES.includes(booking.state);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {booking.car.make} {booking.car.model} {booking.car.year}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatIsoDate(booking.period.start)} →{" "}
              {formatIsoDate(booking.period.end)} ·{" "}
              {booking.pickup.type === "delivery"
                ? booking.pickup.deliveryAddress
                  ? "Door-to-door delivery"
                  : `Delivery: ${booking.pickup.deliveryZoneName ?? "zone"}`
                : "Branch pickup"}
            </p>
            <p className="text-sm text-muted-foreground">{booking.agency.name}</p>
          </div>
          <BookingStateBadge state={booking.state} />
        </div>

        <PaymentNotice booking={booking} />

        {/* Responding to a claim has a server-defined deadline. Keep the form
            above long inspection/media records, including on closed bookings. */}
        <ClaimResponseCard booking={booking} />

        {isTerminal ? (
          <ClosedBookingNotice booking={booking} />
        ) : (
          <>
            <RequestWindowNotice booking={booking} />
            <StateTimeline booking={booking} />
          </>
        )}

        {/* Action-first ordering: what needs the customer NOW (deposit
            verification, inspection confirmation, claim response) sits
            above the reference cards. */}
        <DepositBanner booking={booking} />

        <InspectionsSection booking={booking} />

        <SettlementCard booking={booking} />

        <PickupCard booking={booking} />

        <PricingCard booking={booking} />

        <AgreementCard booking={booking} />

        <ReviewSection booking={booking} />

        <CancelSection booking={booking} />
      </div>

      <ChatPanel booking={booking} />
    </div>
  );
}

/**
 * While the request is open: the agency's response window. Unanswered
 * requests expire automatically and the card hold is released — the
 * customer should know nothing is stuck.
 */
function RequestWindowNotice({ booking }: { booking: Booking }) {
  if (booking.state !== "requested") return null;
  return (
    <div
      className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-4 text-sm text-muted-foreground"
      role="status"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
      <span>
        <span className="font-medium text-foreground">
          Waiting for {booking.agency.name} to respond.
        </span>{" "}
        The agency has 24 hours from your request to accept or decline. If
        they do not answer in time (or the pickup date passes first), the
        request expires automatically and the hold on your card is released.
        You can cancel meanwhile — you will see the exact refund before
        confirming.
      </span>
    </div>
  );
}

/**
 * Honest terminal-state banner (rejected / expired / cancelled) with the
 * stored reason. Machine reasons are mapped to copy; free text is shown as
 * written by the agency, an admin or the customer.
 */
function ClosedBookingNotice({ booking }: { booking: Booking }) {
  const reason = closedBookingReason(booking);
  const title =
    booking.state === "rejected"
      ? `${booking.agency.name} declined this request`
      : booking.state === "expired"
        ? "This request expired"
        : "This booking was cancelled";
  const body =
    booking.state === "rejected"
      ? "The hold on your card was released — you have not been charged. You can request another car for the same dates."
      : booking.state === "expired"
        ? "It was not accepted before the deadline, so it closed automatically and the hold on your card was released. Nothing was charged."
        : "Any refund follows the cancellation policy in effect at the time and goes back to the original card within a few business days; a released hold never shows as a charge. The settlement card below shows the exact figures.";

  return (
    <div
      className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-4"
      role="status"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
        <XCircle className="h-4 w-4" />
        {title}
      </p>
      {reason ? (
        <p className="mt-1 text-sm text-red-800">
          <span className="font-medium">Reason: </span>
          {reason}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-red-700">{body}</p>
    </div>
  );
}

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * "Your pickup" — where and how the customer gets the car. Branch address,
 * phone and hours are emitted by the API only once the booking is paid
 * (accepted onwards) AND it's a branch pickup; before that we say so.
 */
function PickupCard({ booking }: { booking: Booking }) {
  const p = booking.pickup;
  const hours = p.branchHours
    ? Object.entries(p.branchHours).sort(
        ([a], [b]) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
      )
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          Your pickup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {p.type === "delivery" ? (
          <>
            <p className="font-medium text-foreground">
              {p.deliveryAddress
                ? "Door-to-door delivery"
                : `Delivery to ${p.deliveryZoneName ?? "your zone"}`}
            </p>
            {p.deliveryAddress ? (
              <p className="text-muted-foreground">
                {p.deliveryAddress}
                {p.deliveryReference ? ` (${p.deliveryReference})` : ""}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {booking.agency.name} brings the car to you; coordinate the
              exact time in the chat.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-foreground">
              {booking.branch.name} · {booking.agency.name}
            </p>
            {p.branchAddress ? (
              <p className="text-muted-foreground">{p.branchAddress}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The exact address, phone and opening hours are shared once the
                agency accepts your request.
              </p>
            )}
            {p.branchPhone ? (
              <p>
                <a
                  href={`tel:${p.branchPhone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {p.branchPhone}
                </a>
              </p>
            ) : null}
            {hours.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {hours.map(([day, range]) => (
                  <div key={day} className="contents">
                    <dt className="font-medium text-foreground">
                      {DAY_LABELS[day] ?? day}
                    </dt>
                    <dd>{range}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Payment-status surface for the OWNING CUSTOMER — `booking.payment` is
 * present only for them (`GET /bookings/:id`, wire `BookingDetailDto`).
 *
 *  - `requires_action` on a live request → prominent banner that RESUMES the
 *    pending 3DS challenge (page was reloaded / closed mid-challenge) via the
 *    SAME state machine the car-page request flow uses
 *    (`use-request-payment`): Stripe next-action → "Verifying…" poll →
 *    refetch on success.
 *  - `failed` → honest terminal notice: no hold exists, nothing was charged,
 *    the backend auto-rejects the request.
 * Anything else (authorized/captured/…) needs no banner — the state
 * timeline already tells the story.
 */
function PaymentNotice({ booking }: { booking: BookingDetailData }) {
  const qc = useQueryClient();
  const resume = useRequestPayment({
    onAuthorized: () => {
      // Fresh detail (payment flips to authorized, the secret is gone) +
      // fresh lists — the request is now actionable by the agency.
      qc.invalidateQueries({ queryKey: bookingKeys.detail(booking.id) });
      qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });

  const payment = booking.payment;
  if (!payment) return null;

  if (payment.status === "failed") {
    // Relevant while the request is dying/dead from the failed authorize;
    // later terminal states speak for themselves.
    if (booking.state !== "requested" && booking.state !== "rejected") {
      return null;
    }
    return (
      <div
        className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-4"
        role="status"
      >
        <p className="text-sm font-semibold text-red-700">Payment failed</p>
        <p className="mt-1 text-sm text-red-700">
          Your card could not be authorized, so this request cannot proceed and
          is closed automatically. You have not been charged — any temporary
          hold is released. You can request the car again with a different
          card.
        </p>
      </div>
    );
  }

  // The resume window: a pending 3DS challenge on a still-open request.
  if (payment.status !== "requires_action" || booking.state !== "requested") {
    return null;
  }

  if (resume.phase.step === "failed") {
    return (
      <div
        className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-4"
        role="status"
      >
        <p className="text-sm font-semibold text-red-700">
          Payment verification failed
        </p>
        <p className="mt-1 text-sm text-red-700">{resume.phase.message}</p>
      </div>
    );
  }

  if (resume.phase.step === "challenge" || resume.phase.step === "verifying") {
    return (
      <div
        className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4"
        role="status"
      >
        <p className="text-sm font-semibold text-amber-900">
          {resume.phase.step === "challenge"
            ? "Bank verification in progress"
            : "Verifying your payment…"}
        </p>
        <p className="mt-1 text-sm text-amber-800">
          {resume.phase.step === "challenge"
            ? "Complete the verification step in your bank's window. Keep this page open."
            : "Verification passed — confirming the payment hold with the bank. This takes a few seconds."}
        </p>
      </div>
    );
  }

  if (resume.phase.step === "authorized") {
    return (
      <div
        className="rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 p-4"
        role="status"
      >
        <p className="text-sm font-semibold text-emerald-700">
          Payment verified — your request is now with the agency.
        </p>
      </div>
    );
  }

  // idle → the resume entry point.
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          Payment verification pending — complete it now
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Your bank requires a quick verification step before your booking
          request can proceed. The agency cannot accept it until this is done.
          You have not been charged yet.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() =>
          resume.start({
            id: booking.id,
            payment: {
              status: "requires_action",
              clientSecret: payment.clientSecret,
            },
          })
        }
      >
        Complete verification
      </Button>
    </div>
  );
}

/**
 * Rate-your-rental card. Shown only once a booking has actually completed
 * (returned or settled) — the same gate the backend enforces. If the customer
 * already left a review, it renders read-only; otherwise a star picker + note.
 */
function ReviewSection({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const completed = booking.state === "returned" || booking.state === "settled";

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const reviewQuery = useQuery({
    queryKey: agencyProfileKeys.reviewForBooking(booking.id),
    queryFn: () => AgenciesApi.reviewForBooking(booking.id),
    enabled: completed,
  });

  const mutation = useMutation({
    mutationFn: () =>
      AgenciesApi.createReview({
        bookingId: booking.id,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: agencyProfileKeys.reviewForBooking(booking.id),
      });
      // The agency's aggregate rating + its reviews list are now stale.
      qc.invalidateQueries({ queryKey: agencyProfileKeys.all });
    },
  });

  if (!completed) return null;

  const existing = reviewQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your review</CardTitle>
      </CardHeader>
      <CardContent>
        {reviewQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : existing ? (
          <div className="space-y-2">
            <StarRating rating={existing.rating} showValue={false} />
            {existing.comment ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {existing.comment}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Thanks for rating {booking.agency.name}.
            </p>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (rating >= 1) mutation.mutate();
            }}
          >
            <p className="text-sm text-muted-foreground">
              How was your rental with {booking.agency.name}?
            </p>
            <StarPicker value={rating} onChange={setRating} />
            <Textarea
              placeholder="Share a few words about your experience (optional)."
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                size="sm"
                disabled={rating < 1 || mutation.isPending}
              >
                {mutation.isPending ? "Submitting…" : "Submit review"}
              </Button>
              {rating < 1 ? (
                <span className="text-xs text-muted-foreground">
                  Pick a rating to submit.
                </span>
              ) : null}
            </div>
            {mutation.isError ? (
              <p className="text-sm text-red-600">{mutation.error.message}</p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Cancellation entry point:
 *  - `requested` / `accepted` → "Cancel booking" opens the quote dialog
 *    (server refund preview + reason + confirm). The one-line hint uses the
 *    server's own `cancellationQuote` (tier + free-until instant) when the
 *    detail carries it, else the generic policy figures.
 *  - a `closed` tier → no self-service cancel (the host is on site).
 *  - `active` → no self-service cancel; explain early return (recorded by
 *    the agency) with the policy figures from the API.
 */
function CancelSection({ booking }: { booking: BookingDetailData }) {
  const [open, setOpen] = useState(false);
  const legal = useLegalCurrent();
  const policy = legal.data?.cancellationPolicy;
  const quote = booking.cancellationQuote;

  if (booking.state === "active") {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Returning early?</span>{" "}
        Hand the car back to {booking.agency.name} and they will record the
        return.{" "}
        {policy
          ? `Unused full days are refunded minus a penalty of ${formatDays(policy.earlyReturnPenaltyDays)}.`
          : "Unused full days are refunded minus the early-return penalty in our cancellation policy."}
      </div>
    );
  }

  const cancellable =
    booking.state === "requested" || booking.state === "accepted";
  if (!cancellable) return null;

  if (quote?.tier === "closed") {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          Online cancellation has closed
        </span>{" "}
        — the pickup day is here. To cancel, contact {booking.agency.name}{" "}
        through the booking chat; the host or our support team can do it for
        you.
      </div>
    );
  }

  const retentionPct = policy?.lateCancellationRetentionPct;
  const hint =
    quote?.tier === "free" && quote.freeUntil
      ? ` Free cancellation until ${formatDateTime(quote.freeUntil)}.`
      : quote?.tier === "late"
        ? retentionPct !== undefined
          ? ` Cancelling now is a late cancellation: ${retentionPct}% of the rental subtotal is retained.`
          : " Cancelling now is a late cancellation: part of the rental subtotal is retained."
        : policy
          ? ` Free until ${policy.freeCancellationHours} hour${policy.freeCancellationHours === 1 ? "" : "s"} before pickup.`
          : "";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">
        Need to cancel? You will see the exact refund before confirming.
        {hint}
      </p>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Cancel booking
      </Button>
      <CancelBookingDialog
        booking={booking}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
