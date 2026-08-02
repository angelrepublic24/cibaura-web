"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import { BOOKING_STATES, type Booking, type BookingState } from "@/shared/types/domain";
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
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * /agency/requests — the booking inbox. Defaults to `requested` (pending
 * accept/reject); accepting runs the server-side transaction that inserts the
 * occupancy row + captures payment atomically (it can come back rejected as
 * `no_longer_available` if the car was taken meanwhile — the server owns that).
 */
export default function AgencyRequestsPage() {
  const { can } = usePermission();
  const canHandle = can("bookings:handle");

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
                <RequestRow
                  key={b.id}
                  booking={b}
                  listState={state}
                  listPage={page}
                  canHandle={canHandle}
                />
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

function RequestRow({
  booking,
  listState,
  listPage,
  canHandle,
}: {
  booking: Booking;
  listState: BookingState;
  listPage: number;
  canHandle: boolean;
}) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: agencyKeys.requests({ state: listState, page: listPage }) });
    qc.invalidateQueries({ queryKey: agencyKeys.all });
  };

  const accept = useMutation({
    mutationFn: () => AgencyApi.acceptRequest(booking.id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: () => AgencyApi.rejectRequest(booking.id, reason.trim() || "declined"),
    onSuccess: () => {
      setRejecting(false);
      setReason("");
      invalidate();
    },
  });

  const pending = booking.state === "requested" && canHandle;
  const busy = accept.isPending || reject.isPending;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/account/bookings/${booking.id}`}
              className="font-medium hover:underline"
            >
              {booking.car.make} {booking.car.model} {booking.car.year}
            </Link>
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

        {pending ? (
          rejecting ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor={`reason-${booking.id}`}>Reason for rejection</Label>
              <Input
                id={`reason-${booking.id}`}
                placeholder="e.g. Car unavailable for these dates"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => reject.mutate()}
                >
                  {reject.isPending ? "Rejecting…" : "Confirm reject"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRejecting(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? "Accepting…" : "Accept"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setRejecting(true)}
              >
                Reject
              </Button>
            </div>
          )
        ) : null}

        {accept.isError ? (
          <p className="text-sm text-red-600">{accept.error.message}</p>
        ) : null}
        {reject.isError ? (
          <p className="text-sm text-red-600">{reject.error.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
