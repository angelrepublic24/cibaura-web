"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Inbox } from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import type { Booking } from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatIsoDate, todayIso } from "@/shared/utils/dates";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** /agency — dashboard home: headline stats + upcoming pickups from real queries. */
export default function AgencyDashboardPage() {
  const fleetQuery = useQuery({
    queryKey: agencyKeys.fleet(),
    queryFn: () => AgencyApi.fleet(),
  });
  const requestsQuery = useQuery({
    queryKey: agencyKeys.requests({ state: "requested" }),
    queryFn: () => AgencyApi.requests({ state: "requested" }),
  });
  const acceptedQuery = useQuery({
    queryKey: agencyKeys.requests({ state: "accepted" }),
    queryFn: () => AgencyApi.requests({ state: "accepted" }),
  });
  const activeQuery = useQuery({
    queryKey: agencyKeys.requests({ state: "active" }),
    queryFn: () => AgencyApi.requests({ state: "active" }),
  });
  const walletQuery = useQuery({
    queryKey: agencyKeys.wallet(),
    queryFn: AgencyApi.wallet,
  });

  const stats: StatProps[] = [
    {
      label: "Cars in fleet",
      value: fleetQuery.data ? String(fleetQuery.data.total) : undefined,
      loading: fleetQuery.isLoading,
      error: fleetQuery.isError,
      href: "/agency/fleet",
    },
    {
      label: "Pending requests",
      value: requestsQuery.data ? String(requestsQuery.data.total) : undefined,
      loading: requestsQuery.isLoading,
      error: requestsQuery.isError,
      href: "/agency/requests",
      emphasis: (requestsQuery.data?.total ?? 0) > 0,
    },
    {
      label: "Out now",
      value: activeQuery.data ? String(activeQuery.data.total) : undefined,
      loading: activeQuery.isLoading,
      error: activeQuery.isError,
      href: "/agency/calendar",
    },
    {
      label: "Wallet balance",
      value: walletQuery.data
        ? formatMoneyCents(
            walletQuery.data.account.balanceCents,
            walletQuery.data.account.currency,
          )
        : undefined,
      loading: walletQuery.isLoading,
      error: walletQuery.isError,
      href: "/agency/wallet",
    },
  ];

  // Upcoming pickups = accepted-but-not-yet-out bookings, soonest first.
  const upcoming = [...(acceptedQuery.data?.items ?? [])].sort((a, b) =>
    a.period.start.localeCompare(b.period.start),
  );

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-foreground">Agency dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <UpcomingPickups
          bookings={upcoming}
          loading={acceptedQuery.isLoading}
          error={acceptedQuery.isError}
        />
        <PendingRequests
          bookings={requestsQuery.data?.items ?? []}
          loading={requestsQuery.isLoading}
          error={requestsQuery.isError}
        />
      </div>
    </div>
  );
}

// ── stat card ────────────────────────────────────────────────────────────────

interface StatProps {
  label: string;
  value?: string;
  loading: boolean;
  error: boolean;
  href: string;
  emphasis?: boolean;
}

function Stat({ label, value, loading, error, href, emphasis }: StatProps) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-border-strong">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : error ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                "text-3xl font-bold tracking-tight",
                emphasis ? "text-primary" : "text-foreground",
              )}
            >
              {value}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ── upcoming pickups ─────────────────────────────────────────────────────────

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const [ty, tm, td] = todayIso().split("-").map(Number);
  const today = new Date(ty, tm - 1, td).getTime();
  return Math.round((target - today) / 86_400_000);
}

function whenLabel(days: number): { label: string; soon: boolean } {
  if (days < 0) return { label: "Started", soon: false };
  if (days === 0) return { label: "Today", soon: true };
  if (days === 1) return { label: "Tomorrow", soon: true };
  return { label: `in ${days} days`, soon: days <= 3 };
}

function UpcomingPickups({
  bookings,
  loading,
  error,
}: {
  bookings: Booking[];
  loading: boolean;
  error: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Upcoming pickups
        </CardTitle>
        <Link
          href="/agency/calendar"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Calendar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Could not load upcoming pickups.
          </p>
        ) : bookings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No upcoming pickups. Accepted bookings show up here, soonest first.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.slice(0, 6).map((b) => {
              const when = whenLabel(daysUntil(b.period.start));
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {b.car.make} {b.car.model} {b.car.year}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatIsoDate(b.period.start)} →{" "}
                      {formatIsoDate(b.period.end)} ·{" "}
                      {b.pickup.type === "delivery" ? "Delivery" : "Branch pickup"}
                    </p>
                  </div>
                  <Badge variant={when.soon ? "warning" : "secondary"}>
                    {when.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── pending requests (needs attention) ───────────────────────────────────────

function PendingRequests({
  bookings,
  loading,
  error,
}: {
  bookings: Booking[];
  loading: boolean;
  error: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-4 w-4 text-primary" />
          Needs your reply
        </CardTitle>
        <Link
          href="/agency/requests"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Requests <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Could not load requests.
          </p>
        ) : bookings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up — no pending requests.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.slice(0, 5).map((b) => (
              <li key={b.id} className="py-3">
                <p className="truncate text-sm font-medium text-foreground">
                  {b.car.make} {b.car.model} {b.car.year}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatIsoDate(b.period.start)} → {formatIsoDate(b.period.end)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
