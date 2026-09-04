"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import { getStripe } from "@/features/payments/stripe";
import type { BookingPayment } from "@/shared/types/domain";

/**
 * Client-side state machine for a booking's pending payment outcome. TWO
 * entry points share it:
 *   1. `POST /bookings` (car page) — feed the create response to `start`.
 *   2. Resume after a reload (booking detail page) — `GET /bookings/:id`
 *      returns `payment { status, clientSecret }` for the owning customer;
 *      feed `{ id, payment }` to the same `start`.
 *
 *  - `authorized`      → nothing to do; `onAuthorized` fires immediately.
 *  - `requires_action` → run the Stripe next-action (3DS challenge) with the
 *    client secret via `stripe.handleNextAction` — the PaymentIntent
 *    was already CONFIRMED server-side, so `confirmCardPayment` would be
 *    wrong here. After the challenge, a Stripe webhook promotes the payment
 *    to `authorized` server-side (async), so we show "Verifying…" and poll
 *    the booking detail until it resolves.
 *  - `failed`          → no hold was placed; the backend auto-rejects the
 *    request. Surface an honest error.
 *
 * Failure signal while polling: the backend's payment-failure listener moves
 * the booking to `rejected` (webhook-driven), so a terminal state during the
 * verify window means the payment died. A booking still `requested` after
 * the webhook grace window is the success signal — the 3DS challenge itself
 * already succeeded client-side at that point.
 *
 * No money is ever computed client-side here; this hook only moves state.
 */

export type RequestPaymentPhase =
  | { step: "idle" }
  /** Stripe's 3DS modal/redirect is running — the bank challenge is open. */
  | { step: "challenge" }
  /** Challenge passed client-side; waiting for the webhook to promote it. */
  | { step: "verifying"; bookingId: string }
  /** Terminal success — `onAuthorized` fired; polling has stopped. */
  | { step: "authorized" }
  | { step: "failed"; message: string };

/**
 * What `start` actually needs: the booking id + its payment outcome. Both
 * the `POST /bookings` response (`BookingWithPayment`) and a detail-page
 * resume (`{ id, payment }`) satisfy it structurally.
 */
export interface PaymentOutcome {
  id: string;
  payment: BookingPayment;
}

/** Give the failure webhook a moment to auto-reject before declaring success. */
const WEBHOOK_GRACE_MS = 5_000;
/** Hard cap on the verify window — after this we stop and tell the truth. */
const VERIFY_TIMEOUT_MS = 45_000;
/** Booking detail poll cadence while verifying. */
const POLL_INTERVAL_MS = 2_000;

const FAILED_MESSAGE =
  "Your card could not be authorized, so the booking request was not " +
  "completed. You have not been charged — any temporary hold is released " +
  "automatically. You can try again or use a different card.";

const TIMEOUT_MESSAGE =
  "We could not confirm your payment in time. If the request does not " +
  "appear under My bookings as “requested”, it was not completed and you " +
  "have not been charged.";

export interface UseRequestPayment {
  phase: RequestPaymentPhase;
  /** Feed the `POST /bookings` response OR a detail-page `{ id, payment }`. */
  start: (booking: PaymentOutcome) => void;
  /** Back to idle so the customer can retry with a fresh request. */
  reset: () => void;
}

export function useRequestPayment({
  onAuthorized,
}: {
  /** Called once the hold is live (or already was) — navigate to the booking. */
  onAuthorized: (bookingId: string) => void;
}): UseRequestPayment {
  const [phase, setPhase] = useState<RequestPaymentPhase>({ step: "idle" });
  const verifyStartedAt = useRef(0);
  // Keep the latest callback without re-running the resolution effect.
  const onAuthorizedRef = useRef(onAuthorized);
  onAuthorizedRef.current = onAuthorized;

  const reset = useCallback(() => setPhase({ step: "idle" }), []);

  const start = useCallback((booking: PaymentOutcome) => {
    const { status, clientSecret } = booking.payment;

    if (status === "failed") {
      setPhase({ step: "failed", message: FAILED_MESSAGE });
      return;
    }

    if (status !== "requires_action") {
      // `authorized` (the common case). Unknown values would only appear on
      // an idempotent replay — the booking page shows the real state anyway.
      setPhase({ step: "authorized" });
      onAuthorizedRef.current(booking.id);
      return;
    }

    if (!clientSecret) {
      // Contract guard: requires_action always carries the secret.
      setPhase({ step: "failed", message: TIMEOUT_MESSAGE });
      return;
    }

    setPhase({ step: "challenge" });
    void (async () => {
      const stripe = await getStripe();
      if (!stripe) {
        // Missing publishable key / Stripe.js blocked — degrade honestly
        // instead of crashing. Without the challenge the hold never
        // completes, so the request cannot proceed (no charge was made).
        setPhase({
          step: "failed",
          message:
            "Payment verification is unavailable right now (payments are " +
            "not configured in this environment). The request was not " +
            "completed and you have not been charged.",
        });
        return;
      }

      // The PaymentIntent is already confirmed server-side — run only the
      // pending next-action (3DS). Stripe opens its own modal/redirect UI.
      const { error } = await stripe.handleNextAction({ clientSecret });
      if (error) {
        // Challenge failed or was dismissed → the gateway reports the intent
        // failed and the backend auto-rejects the request (hold voided).
        setPhase({
          step: "failed",
          message: error.message
            ? `${error.message} The booking request was not completed and you have not been charged.`
            : FAILED_MESSAGE,
        });
        return;
      }

      verifyStartedAt.current = Date.now();
      setPhase({ step: "verifying", bookingId: booking.id });
    })();
  }, []);

  // ── Verification poll ─────────────────────────────────────────────────────
  const verifying = phase.step === "verifying";
  const bookingId = verifying ? phase.bookingId : "";

  const pollQuery = useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => BookingsApi.findById(bookingId),
    enabled: verifying,
    refetchInterval: POLL_INTERVAL_MS,
    // Poll against the server, not the cache, even in the background. The
    // result stays cached under the canonical detail key, so the booking
    // page paints instantly right after the redirect.
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: false, // refetchInterval already retries every tick
  });

  const { data: polled, dataUpdatedAt, errorUpdatedAt } = pollQuery;

  useEffect(() => {
    if (!verifying) return;
    const elapsed = Date.now() - verifyStartedAt.current;

    if (polled) {
      if (polled.state !== "requested") {
        // `rejected` (payment-failure listener) or another terminal state.
        if (
          polled.state === "rejected" ||
          polled.state === "expired" ||
          polled.state === "cancelled"
        ) {
          setPhase({ step: "failed", message: FAILED_MESSAGE });
        } else {
          // Promoted AND accepted already — success beyond doubt. Terminal
          // phase FIRST so the poll stops even when the hook stays mounted
          // (resume on the booking detail page — no navigation happens).
          setPhase({ step: "authorized" });
          onAuthorizedRef.current(polled.id);
        }
        return;
      }
      // Still `requested` after the webhook grace window: the challenge
      // succeeded client-side and nothing rejected it — the hold is live.
      if (elapsed >= WEBHOOK_GRACE_MS) {
        setPhase({ step: "authorized" });
        onAuthorizedRef.current(polled.id);
        return;
      }
    }

    if (elapsed >= VERIFY_TIMEOUT_MS) {
      setPhase({ step: "failed", message: TIMEOUT_MESSAGE });
    }
    // dataUpdatedAt/errorUpdatedAt change on every poll tick, so this effect
    // re-evaluates even when the payload is structurally unchanged.
  }, [verifying, polled, dataUpdatedAt, errorUpdatedAt]);

  return { phase, start, reset };
}
