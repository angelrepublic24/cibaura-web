"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys, type AgencyRequest } from "@/features/agency/api";
import { BookingLifecycleActions } from "@/features/agency/components/booking-lifecycle-actions";
import { RequestDeadline } from "@/features/agency/components/request-deadline";
import { BOOKING_STATES, type BookingState } from "@/shared/types/domain";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatIsoDate } from "@/shared/utils/dates";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * /agency/requests — the booking inbox. Defaults to `requested` (pending
 * accept/reject; each pending row shows its auto-expiry countdown). Later
 * states surface the follow-up lifecycle actions (pickup → return → settle)
 * via the shared <BookingLifecycleActions/>. Accepting runs the server-side
 * transaction that inserts the occupancy row + captures payment atomically
 * (it can come back rejected as `no_longer_available` — the server owns that).
 */
export default function AgencyRequestsPage() {
  const [state, setState] = useState<BookingState>("requested");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: agencyKeys.requests({ state, page }),
    queryFn: () => AgencyApi.requests({ state, page }),
  });

  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 20;
  const hasNext = page * pageSize < total;

  return (
    <div>
      <h1 className="text-2xl font-bold">Booking requests</h1>

      <div className="mt-4 max-w-xs space-y-1.5">
        <Label htmlFor="req-state">Status</Label>
        <Select
          id="req-state"
          value={state}
          onChange={(e) => {
            setState(e.target.value as BookingState);
            setPage(1);
          }}
        >
          {BOOKING_STATES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <LoadingState label="Loading requests…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load requests"
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : (query.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title={`No ${state} bookings`}
            description="Requests customers send appear here for you to accept or reject."
          />
        ) : (
          <>
            <div className="space-y-3">
              {query.data!.items.map((b) => (
                <RequestRow key={b.id} booking={b} />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RequestRow({ booking }: { booking: AgencyRequest }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/agency/requests/${booking.id}`}
                className="font-medium hover:underline"
              >
                {booking.car.make} {booking.car.model} {booking.car.year}
              </Link>
              <RequestDeadline expiresAt={booking.expiresAt} />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatIsoDate(booking.period.start)} →{" "}
              {formatIsoDate(booking.period.end)} ·{" "}
              {booking.pickup.type === "delivery"
                ? `Delivery: ${booking.pickup.deliveryZoneName ?? "zone"}`
                : "Branch pickup"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-semibold">
              {formatMoneyCents(
                booking.pricing.totalCents,
                booking.pricing.currency,
              )}
            </span>
            <BookingStateBadge state={booking.state} />
          </div>
        </div>

        <BookingLifecycleActions booking={booking} />
      </CardContent>
    </Card>
  );
}
