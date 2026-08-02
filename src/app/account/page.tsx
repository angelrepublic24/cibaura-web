"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import { BookingStateBadge } from "@/shared/components/booking-state-badge";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatIsoDate } from "@/shared/utils/dates";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { buttonVariants } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

/** /account — the customer's bookings list. */
export default function AccountBookingsPage() {
  const query = useQuery({
    queryKey: bookingKeys.mine(),
    queryFn: () => BookingsApi.findMine(),
  });

  if (query.isLoading) return <LoadingState label="Loading your bookings…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load bookings"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const bookings = query.data ?? [];

  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        description="Search for a car and send your first booking request."
        action={
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Find a car
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <Link key={b.id} href={`/account/bookings/${b.id}`} className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {b.car.make} {b.car.model} {b.car.year}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatIsoDate(b.period.start)} → {formatIsoDate(b.period.end)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">
                  {formatMoneyCents(b.pricing.totalCents, b.pricing.currency)}
                </span>
                <BookingStateBadge state={b.state} />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
