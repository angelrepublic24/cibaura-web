"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { BookingsApi } from "@/features/bookings/api";
import { invalidateBooking } from "@/features/bookings/hooks";
import { depositStatusMeta } from "@/features/bookings/labels";
import {
  retryDepositSchema,
  type RetryDepositFormValues,
} from "@/features/bookings/schemas";
import { useRequestPayment } from "@/features/bookings/use-request-payment";
import {
  PaymentMethodsApi,
  paymentMethodKeys,
} from "@/features/payments/api";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import {
  BOOKING_TERMINAL_STATES,
  type BookingDetail,
  type DepositDto,
  type PaymentMethod,
} from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatDateTime } from "@/shared/utils/dates";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { cn } from "@/lib/utils";

/** "Visa •••• 4242 — expires 12/2027" for the card `<option>` rows. */
function formatCardOption(c: PaymentMethod): string {
  const brand = c.brand
    ? c.brand.charAt(0).toUpperCase() + c.brand.slice(1)
    : "Card";
  const month = String(c.expMonth).padStart(2, "0");
  return `${brand} •••• ${c.last4} — expires ${month}/${c.expYear}`;
}

type Tone = "info" | "warning" | "success" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  info: "border-border bg-muted/60",
  warning: "border-amber-200 bg-amber-50",
  success: "border-emerald-200 bg-emerald-50",
  danger: "border-red-200 bg-red-50",
};

const TONE_TEXT: Record<Tone, string> = {
  info: "text-muted-foreground",
  warning: "text-amber-800",
  success: "text-emerald-800",
  danger: "text-red-700",
};

function Panel({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("rounded-[var(--radius-sm)] border p-4", TONE_CLASS[tone])}
      role="status"
    >
      <p className={cn("text-sm font-semibold", TONE_TEXT[tone])}>{title}</p>
      {children ? (
        <div className={cn("mt-1 space-y-2 text-sm", TONE_TEXT[tone])}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Security-deposit surface for the OWNING CUSTOMER (ADR-0013). Before the
 * hold exists it states the amount frozen on the booking; once
 * `booking.deposit` exists it mirrors the server's status verbatim:
 *  - `requires_action` → resume the bank challenge with the deposit's
 *    client secret through the SAME state machine as the rental hold
 *    (`useRequestPayment`, purpose `deposit`) → "Verifying…" poll → refetch;
 *  - `failed` / `lapsed` → place the hold again on any saved card
 *    (`POST /bookings/:id/deposit/retry`);
 *  - `held` / `reauthorizing` / `released` / `captured` → informational copy.
 * The amounts are the server's; nothing is derived here.
 */
export function DepositBanner({ booking }: { booking: BookingDetail }) {
  const qc = useQueryClient();
  const deposit = booking.deposit;
  const isTerminal = BOOKING_TERMINAL_STATES.includes(booking.state);

  const challenge = useRequestPayment({
    purpose: "deposit",
    onAuthorized: () => invalidateBooking(qc, booking.id),
  });

  // No row yet: announce the frozen amount while the booking is heading to
  // check-in; nothing to say for walk-ins/no-deposit cars or closed bookings.
  if (!deposit) {
    if (booking.depositCents <= 0 || isTerminal) return null;
    if (booking.state !== "requested" && booking.state !== "accepted") {
      return null;
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Security deposit
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A deposit of{" "}
          <span className="font-medium text-foreground">
            {formatMoneyCents(booking.depositCents, booking.pricing.currency)}
          </span>{" "}
          is held on your card when {booking.agency.name} starts the check-in
          — not charged. It is released after check-out unless the host
          reports damage, in which case you can respond before anything is
          captured.
        </CardContent>
      </Card>
    );
  }

  if (deposit.status === "waived") return null;

  const meta = depositStatusMeta(deposit.status);
  const amount = formatMoneyCents(deposit.amountCents, deposit.currency);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Security deposit · {amount}
          </CardTitle>
          <Badge variant={meta.tone}>{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <DepositBody
          booking={booking}
          deposit={deposit}
          amount={amount}
          challenge={challenge}
        />
      </CardContent>
    </Card>
  );
}

/** True once the server reports a post-hold state — the hold outcome is settled. */
function holdSettled(status: string): boolean {
  return (
    status === "held" ||
    status === "reauthorizing" ||
    status === "released" ||
    status === "captured" ||
    status === "waived"
  );
}

function DepositBody({
  booking,
  deposit,
  amount,
  challenge,
}: {
  booking: BookingDetail;
  deposit: DepositDto;
  amount: string;
  challenge: ReturnType<typeof useRequestPayment>;
}) {
  const phase = challenge.phase;
  // The hook's terminal phases only speak until the server catches up
  // (webhook → refetch); after that the server's status is the truth, so a
  // later `released`/`captured` is never hidden behind a stale "confirmed".
  const serverCaughtUp = holdSettled(deposit.status);

  // A challenge in flight takes over whatever the server said a moment ago.
  if (phase.step === "challenge" || phase.step === "verifying") {
    return (
      <Panel
        tone="warning"
        title={
          phase.step === "challenge"
            ? "Bank verification in progress"
            : "Verifying the deposit hold…"
        }
      >
        <p className="flex items-start gap-2">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
          {phase.step === "challenge"
            ? "Complete the verification step in your bank's window. Keep this page open."
            : "Verification passed — confirming the hold with the bank. This takes a few seconds."}
        </p>
      </Panel>
    );
  }
  if (phase.step === "authorized" && !serverCaughtUp) {
    return (
      <Panel tone="success" title="Deposit hold confirmed">
        <p>{amount} is now held on your card. Nothing has been charged.</p>
      </Panel>
    );
  }
  if (phase.step === "failed" && !serverCaughtUp) {
    return (
      <>
        <Panel tone="danger" title="Deposit verification failed">
          <p>{phase.message}</p>
        </Panel>
        <RetryDepositForm
          booking={booking}
          challenge={challenge}
          onReset={challenge.reset}
        />
      </>
    );
  }

  // Hoisted so the 3DS handler below closes over a narrowed, stable value.
  const clientSecret = deposit.clientSecret;

  switch (deposit.status) {
    case "pending_hold":
      return (
        <Panel tone="info" title="Placing the hold on your card">
          <p>
            {booking.agency.name} has started the check-in. We are placing a
            hold of {amount} on the card used for this booking — it is not a
            charge. This page updates automatically.
          </p>
        </Panel>
      );
    case "requires_action":
      return (
        <Panel tone="warning" title="Your bank needs to verify the deposit hold">
          <p>
            The check-in cannot be completed until the hold of {amount} is
            confirmed. Your bank requires a quick verification step; you have
            not been charged.
          </p>
          {clientSecret ? (
            <Button
              size="sm"
              onClick={() =>
                challenge.startChallenge({
                  bookingId: booking.id,
                  clientSecret,
                })
              }
            >
              Complete verification
            </Button>
          ) : (
            <p className="text-xs">
              Reload this page to continue the verification.
            </p>
          )}
        </Panel>
      );
    case "held":
      return (
        <Panel tone="success" title={`${amount} is held on your card`}>
          <p>
            This is a hold, not a charge. It is released automatically after
            check-out unless the host reports damage — then you can accept or
            reject the claim before anything is captured.
            {deposit.captureBefore
              ? ` Banks limit how long a hold lasts; if the rental runs past ${formatDateTime(deposit.captureBefore)} we renew it automatically on the same card.`
              : ""}
          </p>
        </Panel>
      );
    case "reauthorizing":
      return (
        <Panel tone="info" title="Renewing the deposit hold">
          <p>
            Your bank&apos;s hold window is ending, so we are placing a fresh
            hold of {amount} on the same card and releasing the previous one.
            No action is needed.
          </p>
        </Panel>
      );
    case "released":
      return (
        <Panel tone="success" title="Deposit released">
          <p>
            The hold of {amount} was released — nothing was charged. A
            released hold never shows as a charge and disappears from your
            statement within a few business days.
          </p>
        </Panel>
      );
    case "captured":
      return (
        <Panel tone="danger" title="Deposit captured for an approved damage claim">
          <p>
            {formatMoneyCents(deposit.capturedCents, deposit.currency)} of the{" "}
            {amount} hold was captured following the approved claim (details
            below). Any remainder was released to your card.
          </p>
        </Panel>
      );
    case "failed":
      return (
        <>
          <Panel tone="danger" title="The deposit hold failed">
            <p>
              Your card declined the hold of {amount}. The host cannot
              complete the check-in until a deposit is held. Nothing was
              charged. Place the hold again — on this card or another saved
              card.
            </p>
          </Panel>
          <RetryDepositForm booking={booking} challenge={challenge} />
        </>
      );
    case "lapsed":
      return (
        <>
          <Panel tone="danger" title="The deposit hold expired">
            <p>
              The bank&apos;s hold on {amount} expired before it could be
              renewed. Nothing was charged. If the host files a damage claim,
              our team will contact you about it. You can place a new hold
              below.
            </p>
          </Panel>
          <RetryDepositForm booking={booking} challenge={challenge} />
        </>
      );
    default:
      return (
        <Panel tone="info" title={`Deposit status: ${deposit.status}`}>
          <p>{amount} deposit on this booking.</p>
        </Panel>
      );
  }
}

/** Copy for the retry-time codes (spec §0.2); anything else → server message. */
function describeRetryError(error: unknown): string {
  if (isApiErrorCode(error, API_ERROR_CODES.DEPOSIT_REQUIRES_ACTION)) {
    return "A bank verification for this deposit is already pending — complete it first. Refreshing the deposit status…";
  }
  return getErrorMessage(
    error,
    "The deposit hold could not be placed. Please try again.",
  );
}

/**
 * Place the deposit hold again on a saved card. The outcome is the new
 * `DepositDto`: `requires_action` hands the client secret to the 3DS state
 * machine; anything else simply refetches the booking.
 */
function RetryDepositForm({
  booking,
  challenge,
  onReset,
}: {
  booking: BookingDetail;
  challenge: ReturnType<typeof useRequestPayment>;
  /** Clears a previous failed challenge before a new attempt. */
  onReset?: () => void;
}) {
  const qc = useQueryClient();
  const cardsQuery = useQuery({
    queryKey: paymentMethodKeys.mine(),
    queryFn: PaymentMethodsApi.findMine,
  });
  const cards = cardsQuery.data ?? [];

  const form = useForm<RetryDepositFormValues>({
    resolver: zodResolver(retryDepositSchema),
    defaultValues: { paymentMethodId: "" },
  });

  const retry = useMutation({
    mutationFn: (values: RetryDepositFormValues) =>
      BookingsApi.retryDeposit(booking.id, values.paymentMethodId),
    onSuccess: (deposit) => {
      if (deposit.status === "requires_action" && deposit.clientSecret) {
        challenge.startChallenge({
          bookingId: booking.id,
          clientSecret: deposit.clientSecret,
        });
      }
      invalidateBooking(qc, booking.id);
    },
    onError: (error) => {
      if (isApiErrorCode(error, API_ERROR_CODES.DEPOSIT_REQUIRES_ACTION)) {
        // The pending challenge (and its secret) lives on the detail.
        invalidateBooking(qc, booking.id);
      }
    },
  });

  return (
    <form
      noValidate
      className="space-y-3 rounded-[var(--radius-sm)] border border-border p-4"
      onSubmit={form.handleSubmit((values) => {
        onReset?.();
        retry.mutate(values);
      })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="deposit-card">Place the hold on</Label>
        {cardsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your cards…</p>
        ) : cardsQuery.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700">
              {getErrorMessage(cardsQuery.error, "Could not load your cards.")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => cardsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no saved card.{" "}
            <Link
              href="/account/payment-methods"
              className="font-medium text-primary underline underline-offset-2"
            >
              Add a card
            </Link>{" "}
            and come back to place the hold.
          </p>
        ) : (
          <Select
            id="deposit-card"
            aria-invalid={!!form.formState.errors.paymentMethodId}
            disabled={retry.isPending}
            {...form.register("paymentMethodId")}
          >
            <option value="">Choose a card</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {formatCardOption(c)}
              </option>
            ))}
          </Select>
        )}
        {form.formState.errors.paymentMethodId ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.paymentMethodId.message}
          </p>
        ) : null}
      </div>

      {retry.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {describeRetryError(retry.error)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={retry.isPending || cards.length === 0}
        >
          {retry.isPending ? "Placing the hold…" : "Place the deposit hold"}
        </Button>
        <Link
          href="/account/payment-methods"
          className="text-xs text-primary underline underline-offset-2"
        >
          Manage cards
        </Link>
      </div>
    </form>
  );
}
