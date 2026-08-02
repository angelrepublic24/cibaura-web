"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, Send } from "lucide-react";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import {
  BOOKING_HAPPY_PATH,
  BOOKING_TERMINAL_STATES,
  type Booking,
} from "@/shared/types/domain";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";
import { formatIsoDate } from "@/shared/utils/dates";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";

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
                ? `Delivery: ${booking.pickup.deliveryZoneName ?? "zone"}`
                : "Branch pickup"}
            </p>
            <p className="text-sm text-muted-foreground">{booking.agency.name}</p>
          </div>
          <BookingStateBadge state={booking.state} />
        </div>

        <StateTimeline booking={booking} />

        <PricingCard booking={booking} />

        <CancelSection booking={booking} />
      </div>

      <ChatPanel bookingId={bookingId} />
    </div>
  );
}

/** Happy-path timeline with the current state highlighted; terminal
 *  branches (rejected/expired/cancelled) render as a banner instead. */
function StateTimeline({ booking }: { booking: Booking }) {
  const isTerminal = BOOKING_TERMINAL_STATES.includes(booking.state);
  const currentIdx = BOOKING_HAPPY_PATH.indexOf(booking.state);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Booking progress</CardTitle>
      </CardHeader>
      <CardContent>
        {isTerminal ? (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            This booking ended as <strong>{booking.state}</strong>
            {booking.stateReason ? ` — ${booking.stateReason}` : ""}.
          </div>
        ) : (
          <ol className="flex flex-wrap items-center gap-2">
            {BOOKING_HAPPY_PATH.map((state, i) => {
              const done = i < currentIdx;
              const current = i === currentIdx;
              return (
                <li key={state} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && "border-primary text-primary",
                      !done && !current && "border-border text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-sm capitalize",
                      current ? "font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {state}
                  </span>
                  {i < BOOKING_HAPPY_PATH.length - 1 ? (
                    <span className="mx-1 h-px w-6 bg-border" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Frozen server-side pricing snapshot, rendered verbatim. */
function PricingCard({ booking }: { booking: Booking }) {
  const p = booking.pricing;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Price breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>
              {p.days} day{p.days === 1 ? "" : "s"} x{" "}
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
            <dt>Service fee ({formatPct(p.commissionPct)})</dt>
            <dd>{formatMoneyCents(p.commissionCents, p.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{formatMoneyCents(p.totalCents, p.currency)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Snapshot frozen at request time — computed by the server.
        </p>
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

/** In-app chat with the agency (1 thread per booking). Skeleton: list +
 *  composer wired to the messages endpoints; realtime lands later. */
function ChatPanel({ bookingId }: { bookingId: string }) {
  const [body, setBody] = useState("");
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: bookingKeys.messages(bookingId),
    queryFn: () => BookingsApi.listMessages(bookingId),
  });

  const send = useMutation({
    mutationFn: () => BookingsApi.sendMessage(bookingId, body.trim()),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: bookingKeys.messages(bookingId) });
    },
  });

  return (
    <Card className="flex h-fit flex-col lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Chat with the agency
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {query.isLoading ? (
            <LoadingState label="Loading messages…" className="py-6" />
          ) : query.isError ? (
            <p className="text-sm text-muted-foreground">
              Messages could not be loaded.
            </p>
          ) : (query.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Say hi — coordinate pickup details here."
              className="py-6"
            />
          ) : (
            query.data!.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.senderRole === "customer"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {m.body}
              </div>
            ))
          )}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate();
          }}
        >
          <Input
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!body.trim() || send.isPending}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
