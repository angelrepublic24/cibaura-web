"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import { getStripe } from "@/features/payments/stripe";
import type { BookingDetail, BookingPayment } from "@/shared/types/domain";

/**
 * Client-side state machine for a pending card authorization that may need
 * a 3DS challenge. Two PURPOSES share it (`purpose` option):
 *
 *  - `booking` (default) — the rental hold placed by `POST /bookings`.
 *    Entry points: the create response (car page) via `start`, or a resume
 *    after a reload (booking detail) with the `payment { status,
 *    clientSecret }` block of `GET /bookings/:id`.
 *  - `deposit` — the security-deposit hold placed at check-in (ADR-0013).
 *    Entry point: `startChallenge` with `deposit.clientSecret` from
 *    `GET /bookings/:id` while the deposit is `requires_action`, or the
 *    `DepositDto` returned by `POST /bookings/:id/deposit/retry`.
 *
 *  - `authorized`      → nothing to do; `onAuthorized` fires immediately.
 *  - `requires_action` → run the Stripe next-action (3DS challenge) with the
 *    client secret via `stripe.handleNextAction` — the PaymentIntent
 *    was already CONFIRMED server-side, so `confirmCardPayment` would be
 *    wrong here. After the challenge, a Stripe webhook promotes the hold
 *    server-side (async), so we show "Verifying…" and poll the booking
 *    detail until it resolves.
 *  - `failed`          → no hold was placed. Surface an honest error.
 *
 * Resolution while polling (per purpose):
 *  - booking: the payment-failure listener moves the booking to `rejected`
 *    (webhook-driven), so a terminal state during the verify window means
 *    the payment died. A booking still `requested` after the webhook grace
 *    window is the success signal — the challenge already succeeded
 *    client-side at that point.
 *  - deposit: the `amount_capturable_updated` webhook flips the deposit to
 *    `held` (success); `failed`/`lapsed` is the failure signal; anything
 *    else keeps polling until the timeout.
 *
 * No money is ever computed client-side here; this hook only moves state.
 */

export type PaymentPurpose = "booking" | "deposit";

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

/** A pending 3DS challenge, whatever the hold is for. */
export interface PendingChallenge {
  bookingId: string;
  clientSecret: string;
}

/** Give the failure webhook a moment to auto-reject before declaring success. */
const WEBHOOK_GRACE_MS = 5_000;
/** Hard cap on the verify window — after this we stop and tell the truth. */
const VERIFY_TIMEOUT_MS = 45_000;
/** Booking detail poll cadence while verifying. */
const POLL_INTERVAL_MS = 2_000;

interface PurposeCopy {
  failed: string;
  timeout: string;
  unavailable: string;
  /** Appended to the bank's own error message when the challenge fails. */
  afterBankError: string;
}

const COPY: Record<PaymentPurpose, PurposeCopy> = {
  booking: {
    failed:
      "Your card could not be authorized, so the booking request was not " +
      "completed. You have not been charged — any temporary hold is released " +
      "automatically. You can try again or use a different card.",
    timeout:
      "We could not confirm your payment in time. If the request does not " +
      "appear under My bookings as “requested”, it was not completed and you " +
      "have not been charged.",
    unavailable:
      "Payment verification is unavailable right now (payments are not " +
      "configured in this environment). The request was not completed and " +
      "you have not been charged.",
    afterBankError:
      "The booking request was not completed and you have not been charged.",
  },
  deposit: {
    failed:
      "The security-deposit hold could not be verified. Nothing was charged " +
      "— you can place the hold again, on this or another saved card, so the " +
      "host can complete the check-in.",
    timeout:
      "We could not confirm the deposit hold in time. Refresh this page in a " +
      "moment — if it still shows as needing verification, try again.",
    unavailable:
      "Card verification is unavailable right now (payments are not " +
      "configured in this environment). The deposit hold was not completed.",
    afterBankError:
      "The deposit hold was not completed; you can try again below.",
  },
};

type Verdict = "pending" | "authorized" | "failed";

function resolveBooking(polled: BookingDetail, elapsed: number): Verdict {
  if (polled.state !== "requested") {
    // `rejected` (payment-failure listener) or another terminal state.
    return polled.state === "rejected" ||
      polled.state === "expired" ||
      polled.state === "cancelled"
      ? "failed"
      : // Promoted AND accepted already — success beyond doubt.
        "authorized";
  }
  // Still `requested` after the webhook grace window: the challenge
  // succeeded client-side and nothing rejected it — the hold is live.
  return elapsed >= WEBHOOK_GRACE_MS ? "authorized" : "pending";
}

function resolveDeposit(polled: BookingDetail): Verdict {
  switch (polled.deposit?.status) {
    case "held":
    case "reauthorizing":
    case "released":
    case "captured":
    case "waived":
      // Any post-hold state proves the hold went through.
      return "authorized";
    case "failed":
    case "lapsed":
      return "failed";
    default:
      // `requires_action` / `pending_hold` / no row yet → keep polling.
      return "pending";
  }
}

export interface UseRequestPayment {
  phase: RequestPaymentPhase;
  /** Feed the `POST /bookings` response OR a detail-page `{ id, payment }`. */
  start: (booking: PaymentOutcome) => void;
  /** Run the 3DS next-action for an already-confirmed intent (any purpose). */
  startChallenge: (challenge: PendingChallenge) => void;
  /** Back to idle so the customer can retry with a fresh request. */
  reset: () => void;
}

export function useRequestPayment({
  onAuthorized,
  purpose = "booking",
}: {
  /** Called once the hold is live (or already was) — navigate/refetch. */
  onAuthorized: (bookingId: string) => void;
  purpose?: PaymentPurpose;
}): UseRequestPayment {
  const [phase, setPhase] = useState<RequestPaymentPhase>({ step: "idle" });
  const verifyStartedAt = useRef(0);
  // Keep the latest callback without re-running the resolution effect.
  const onAuthorizedRef = useRef(onAuthorized);
  onAuthorizedRef.current = onAuthorized;
  const copy = COPY[purpose];

  const reset = useCallback(() => setPhase({ step: "idle" }), []);

  const startChallenge = useCallback(
    ({ bookingId, clientSecret }: PendingChallenge) => {
      setPhase({ step: "challenge" });
      void (async () => {
        const stripe = await getStripe();
        if (!stripe) {
          // Missing publishable key / Stripe.js blocked — degrade honestly
          // instead of crashing. Without the challenge the hold never
          // completes (no charge was made).
          setPhase({ step: "failed", message: copy.unavailable });
          return;
        }

        // The PaymentIntent is already confirmed server-side — run only the
        // pending next-action (3DS). Stripe opens its own modal/redirect UI.
        const { error } = await stripe.handleNextAction({ clientSecret });
        if (error) {
          // Challenge failed or was dismissed → the gateway reports the
          // intent failed and the backend records it (hold voided).
          setPhase({
            step: "failed",
            message: error.message
              ? `${error.message} ${copy.afterBankError}`
              : copy.failed,
          });
          return;
        }

        verifyStartedAt.current = Date.now();
        setPhase({ step: "verifying", bookingId });
      })();
    },
    [copy],
  );

  const start = useCallback(
    (booking: PaymentOutcome) => {
      const { status, clientSecret } = booking.payment;

      if (status === "failed") {
        setPhase({ step: "failed", message: copy.failed });
        return;
      }

      if (status !== "requires_action") {
        // `authorized` (the common case). Unknown values would only appear
        // on an idempotent replay — the booking page shows the real state.
        setPhase({ step: "authorized" });
        onAuthorizedRef.current(booking.id);
        return;
      }

      if (!clientSecret) {
        // Contract guard: requires_action always carries the secret.
        setPhase({ step: "failed", message: copy.timeout });
        return;
      }

      startChallenge({ bookingId: booking.id, clientSecret });
    },
    [copy, startChallenge],
  );

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
      const verdict =
        purpose === "deposit"
          ? resolveDeposit(polled)
          : resolveBooking(polled, elapsed);
      if (verdict === "failed") {
        setPhase({ step: "failed", message: copy.failed });
        return;
      }
      if (verdict === "authorized") {
        // Terminal phase FIRST so the poll stops even when the hook stays
        // mounted (resume on the booking detail page — no navigation).
        setPhase({ step: "authorized" });
        onAuthorizedRef.current(polled.id);
        return;
      }
    }

    if (elapsed >= VERIFY_TIMEOUT_MS) {
      setPhase({ step: "failed", message: copy.timeout });
    }
    // dataUpdatedAt/errorUpdatedAt change on every poll tick, so this effect
    // re-evaluates even when the payload is structurally unchanged.
  }, [verifying, polled, dataUpdatedAt, errorUpdatedAt, purpose, copy]);

  return { phase, start, startChallenge, reset };
}
