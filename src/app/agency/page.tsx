"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Inbox } from "lucide-react";
import {
  useAgencyRequests,
  useAgencyWallet,
  useFleet,
  usePermission,
} from "@/modules/agency/hooks/agency.hook";
import type { AgencyPermission } from "@/modules/agency/types/agency.types";
import type { Booking } from "@/shared/types/domain";
import { getErrorMessage } from "@/shared/api/errors";
import { ErrorState } from "@/shared/components/states";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  businessTodayIso,
  formatIsoDate,
  isoDateParts,
} from "@/shared/utils/dates";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * /agency — dashboard home: headline stats + upcoming pickups from real
 * queries.
 *
 * EVERY TILE IS GATED BY THE PERMISSION ITS READ NEEDS (BUG-007).
 *
 * This screen is the one place that queries four different agency surfaces at
 * once, and it used to ask for all four regardless of what the member holds.
 * A `sales` member has no `wallet:view`, so opening the dashboard fired
 * `GET /agency/wallet` and took a 403 — a failed request in their console, a
 * 403 in our logs, and a tile that renders "—" for a reason the member can do
 * nothing about. Hiding the tile alone would not have fixed it: the request is
 * sent by the hook, not by the card, so the PERMISSION HAS TO REACH THE
 * HOOK. Hence `enabled`, and the same flag deciding whether the tile renders
 * at all — one source for both, so they cannot disagree.
 *
 * The other three tiles are gated the same way, by the same bug: a custom
 * member without `fleet:read` or `bookings:read` would 403 exactly as the
 * sales member did on the wallet. The permissions mirror the nav table in
 * `app/agency/layout.tsx`, which is what decides whether the tile's own
 * destination is reachable — a tile that links somewhere the member cannot
 * open is a dead end either way.
 */
export default function AgencyDashboardPage() {
  const {
    can,
    isPending: permPending,
    isError: permError,
    error: permErrorValue,
    refetch: refetchPermissions,
  } = usePermission();

  // Fail CLOSED on an unresolved session: `can` is false while it loads, so
  // nothing is fetched until the permissions are known. In practice the
  // layout has already awaited the session read before this mounts, so this
  // is a guard rather than a visible state.
  const mayReadFleet = can("fleet:read");
  const mayReadBookings = can("bookings:read");
  const mayReadWallet = can("wallet:view");

  const fleetQuery = useFleet({}, mayReadFleet);
  const requestsQuery = useAgencyRequests({ state: "requested" }, mayReadBookings);
  const acceptedQuery = useAgencyRequests({ state: "accepted" }, mayReadBookings);
  const activeQuery = useAgencyRequests({ state: "active" }, mayReadBookings);
  const walletQuery = useAgencyWallet(mayReadWallet);

  const stats: StatProps[] = [
    {
      label: "Cars in fleet",
      permission: "fleet:read",
      value: fleetQuery.data ? String(fleetQuery.data.total) : undefined,
      loading: fleetQuery.isLoading,
      error: fleetQuery.isError,
      href: "/agency/fleet",
    },
    {
      label: "Pending requests",
      permission: "bookings:read",
      value: requestsQuery.data ? String(requestsQuery.data.total) : undefined,
      loading: requestsQuery.isLoading,
      error: requestsQuery.isError,
      href: "/agency/requests",
      emphasis: (requestsQuery.data?.total ?? 0) > 0,
    },
    {
      label: "Out now",
      permission: "bookings:read",
      value: activeQuery.data ? String(activeQuery.data.total) : undefined,
      loading: activeQuery.isLoading,
      error: activeQuery.isError,
      href: "/agency/calendar",
    },
    {
      label: "Wallet balance",
      permission: "wallet:view",
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

  const visibleStats = stats.filter((stat) => can(stat.permission));

  // Upcoming pickups = accepted bookings whose pickup day is still ahead,
  // soonest first. A booking whose start day already passed is OVERDUE, not
  // upcoming (the expiry job closes it), so it is filtered out here instead of
  // rendering as "in -5 days".
  const today = businessTodayIso();
  const upcoming = (acceptedQuery.data?.items ?? [])
    .filter((b) => b.period.start >= today)
    .sort((a, b) => a.period.start.localeCompare(b.period.start));

  // A session read that FAILED leaves permissions unknown, which is not the
  // same as denied: rendering an empty dashboard would read as "you have
  // nothing", so it says what actually happened and offers the retry.
  if (permError) {
    return (
      <ErrorState
        title="Could not check your permissions"
        message={getErrorMessage(permErrorValue, "Please try again.")}
        onRetry={refetchPermissions}
      />
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-foreground">Agency dashboard</h1>

      {permPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <Skeleton key={slot} className="h-28 w-full" />
          ))}
        </div>
      ) : visibleStats.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleStats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Both panels read the bookings inbox, so they follow the same
            permission as the tiles that link to it. */}
        {mayReadBookings ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── stat card ────────────────────────────────────────────────────────────────

interface StatProps {
  label: string;
  /** What the tile's own read needs — and what its destination requires. */
  permission: AgencyPermission;
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
  const { year, month, day } = isoDateParts(iso);
  const target = new Date(year, month - 1, day).getTime();
  const t = isoDateParts(businessTodayIso());
  const today = new Date(t.year, t.month - 1, t.day).getTime();
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
