"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import { ChatPanel } from "@/features/bookings/components/chat-panel";
import {
  PricingCard,
  StateTimeline,
} from "@/features/bookings/components/booking-summary";
import { useRequestPayment } from "@/features/bookings/use-request-payment";
import { AgenciesApi, agencyProfileKeys } from "@/features/agencies/api";
import type { Booking, BookingDetail as BookingDetailData } from "@/shared/types/domain";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { StarPicker, StarRating } from "@/shared/components/star-rating";
import { formatIsoDate } from "@/shared/utils/dates";
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
            {booking.pickup.type === "delivery" &&
            booking.pickup.deliveryAddress ? (
              <p className="text-sm font-medium text-foreground">
                Deliver to: {booking.pickup.deliveryAddress}
                {booking.pickup.deliveryReference
                  ? ` (${booking.pickup.deliveryReference})`
                  : ""}
              </p>
            ) : null}
            {booking.pickup.type !== "delivery" &&
            booking.pickup.branchAddress ? (
              <p className="text-sm font-medium text-foreground">
                Pickup address: {booking.pickup.branchAddress}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">{booking.agency.name}</p>
          </div>
          <BookingStateBadge state={booking.state} />
        </div>

        <PaymentNotice booking={booking} />

        <StateTimeline booking={booking} />

        <PricingCard booking={booking} />

        <ReviewSection booking={booking} />

        <CancelSection booking={booking} />
      </div>

      <ChatPanel booking={booking} />
    </div>
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
          is rejected automatically. You have not been charged — any temporary
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

function CancelSection({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const cancellable = booking.state === "requested" || booking.state === "accepted";

  const mutation = useMutation({
    mutationFn: () => BookingsApi.cancel(booking.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookingKeys.detail(booking.id) });
      qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });

  if (!cancellable) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">
        Need to cancel? The refund follows the cancellation policy.
      </p>
      <Button
        variant="destructive"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Cancelling…" : "Cancel booking"}
      </Button>
      {mutation.isError ? (
        <p className="text-sm text-red-600">{mutation.error.message}</p>
      ) : null}
    </div>
  );
}

