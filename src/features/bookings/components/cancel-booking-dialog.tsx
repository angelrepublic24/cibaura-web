"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import {
  BOOKING_REASON_MAX,
  cancelBookingSchema,
  type CancelBookingFormValues,
} from "@/features/bookings/schemas";
import { useLegalCurrent } from "@/features/legal/hooks";
import { formatHours } from "@/features/legal/components/cancellation-policy";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import type { Booking, CancellationQuoteDto } from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatDateTime } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";

/**
 * Tier copy driven by the SERVER's quote: the tier/free-until/policy fields
 * are additive (spec §5) and used when present; otherwise the legacy
 * `isLate` flag + the figures from `GET /legal/current` tell the story.
 * Amounts never come from here — only the explanation.
 */
function tierExplanation(
  quote: CancellationQuoteDto,
  fallbackPolicy:
    | { freeCancellationHours: number; lateCancellationRetentionPct: number }
    | undefined,
): string {
  const tier = quote.tier ?? (quote.isLate ? "late" : "free");
  const policy = quote.policy ?? fallbackPolicy;

  if (tier === "late") {
    return policy
      ? `This is a late cancellation (less than ${formatHours(policy.freeCancellationHours)} before pickup): ${policy.lateCancellationRetentionPct}% of the rental subtotal is retained and the rest is refunded.`
      : "This is a late cancellation: part of the rental subtotal is retained and the rest is refunded.";
  }
  if (quote.freeUntil) {
    return `Free cancellation — you are still before ${formatDateTime(quote.freeUntil)}, so the full amount is refunded.`;
  }
  return policy
    ? `Free cancellation — you are more than ${formatHours(policy.freeCancellationHours)} before pickup, so the full amount is refunded.`
    : "Free cancellation — the full amount is refunded.";
}

/**
 * Customer cancellation confirmation. Before anything is sent, the dialog
 * fetches `GET /bookings/:id/cancellation-quote` and shows the SERVER's
 * refund / retained amounts (never derived from the policy percentages
 * client-side). Confirming posts `POST /bookings/:id/cancel { reason }`.
 * A 409 CANCELLATION_WINDOW_CLOSED (or a `closed` tier on the quote) means
 * the booking can no longer be cancelled online (the customer contacts the
 * agency instead).
 */
export function CancelBookingDialog({
  booking,
  open,
  onClose,
}: {
  booking: Booking;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const legal = useLegalCurrent();

  const quoteQuery = useQuery({
    queryKey: bookingKeys.cancellationQuote(booking.id),
    queryFn: () => BookingsApi.cancellationQuote(booking.id),
    enabled: open,
    // The quote depends on "now" (hours before pickup) — never serve stale.
    staleTime: 0,
    gcTime: 0,
  });

  const form = useForm<CancelBookingFormValues>({
    resolver: zodResolver(cancelBookingSchema),
    defaultValues: { reason: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CancelBookingFormValues) =>
      BookingsApi.cancel(booking.id, values.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookingKeys.detail(booking.id) });
      qc.invalidateQueries({ queryKey: bookingKeys.all });
      form.reset();
      onClose();
    },
  });

  function close() {
    if (mutation.isPending) return;
    mutation.reset();
    form.reset();
    onClose();
  }

  const quote = quoteQuery.data;
  const policy = legal.data?.cancellationPolicy;
  // The server may refuse at either step: the quote (window already closed
  // when the dialog opens — as a 409 or as tier `closed`) or the cancel
  // itself (closed in the meantime).
  const windowClosed =
    quote?.tier === "closed" ||
    (mutation.isError &&
      isApiErrorCode(
        mutation.error,
        API_ERROR_CODES.CANCELLATION_WINDOW_CLOSED,
      )) ||
    (quoteQuery.isError &&
      isApiErrorCode(
        quoteQuery.error,
        API_ERROR_CODES.CANCELLATION_WINDOW_CLOSED,
      ));

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Cancel this booking?"
      description={`${booking.car.make} ${booking.car.model} ${booking.car.year} · ${booking.agency.name}`}
    >
      {windowClosed ? (
        <div className="space-y-4">
          <div
            className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This booking can no longer be cancelled online — the rental has
              started or is about to. Please contact {booking.agency.name}{" "}
              through the booking chat; the agency or our support team can
              cancel it for you.
            </span>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={close}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          {/* Refund preview — the server's numbers, verbatim. */}
          <div className="rounded-[var(--radius-sm)] border border-border bg-muted/60 p-4">
            {quoteQuery.isLoading ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : quoteQuery.isError ? (
              <div className="space-y-2">
                <p className="text-sm text-red-700">
                  We could not calculate your refund right now.{" "}
                  {getErrorMessage(quoteQuery.error, "")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => quoteQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : quote ? (
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">You will be refunded</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {formatMoneyCents(quote.refundCents, quote.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">
                    Retained by {booking.agency.name}
                  </dt>
                  <dd
                    className={
                      quote.retainedCents > 0
                        ? "font-medium text-red-700"
                        : "font-medium text-foreground"
                    }
                  >
                    {formatMoneyCents(quote.retainedCents, quote.currency)}
                  </dd>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  {tierExplanation(quote, policy)}{" "}
                  {quote.retainedCents > 0
                    ? "The retained amount is charged to your card; any refund goes back to the original card within a few business days."
                    : booking.state === "requested"
                      ? "The card hold is released; nothing was charged."
                      : "Refunds go back to the original card within a few business days."}
                </p>
              </dl>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Let the agency know why you are cancelling."
              maxLength={BOOKING_REASON_MAX}
              autoFocus
              {...form.register("reason")}
            />
            {form.formState.errors.reason ? (
              <p className="text-sm text-red-600">
                {form.formState.errors.reason.message}
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="text-sm text-red-600" role="alert">
              {getErrorMessage(
                mutation.error,
                "Could not cancel the booking. Please try again.",
              )}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Full policy in the{" "}
            <Link
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Terms of Service
            </Link>
            .
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={mutation.isPending}
            >
              Keep booking
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={mutation.isPending || quoteQuery.isLoading || !quote}
            >
              {mutation.isPending ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
