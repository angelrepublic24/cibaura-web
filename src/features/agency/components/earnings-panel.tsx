"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import type {
  AgencyEarnings,
  EarningsBucket,
  HeldEarning,
} from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatDateTime, formatIsoDate } from "@/shared/utils/dates";
import { ErrorState, LoadingState } from "@/shared/components/states";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What the agency has made — the headline of `/agency/wallet`.
 *
 * Three figures, and the difference between them is the point:
 *
 *   AVAILABLE — theirs now, and leaving on the next payout date.
 *   HELD      — credited and visible, not yet theirs to take. Each piece
 *               names the booking and the date it unlocks, because a
 *               balance that is quietly smaller than the total is a
 *               support ticket, and a date is an answer.
 *   PENDING   — earned by rentals under way; arrives when they settle.
 *
 * Every number is server-computed from the ledger. Nothing is added up
 * here: a screen that recomputes money eventually disagrees with it.
 */
export function EarningsPanel() {
  const query = useQuery({
    queryKey: agencyKeys.earnings(),
    queryFn: AgencyApi.earnings,
  });

  if (query.isPending) return <LoadingState label="Loading earnings…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load your earnings"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const earnings = query.data;
  return (
    <div className="space-y-6">
      <Totals earnings={earnings} />
      {earnings.held.length > 0 ? (
        <HeldList held={earnings.held} currency={earnings.currency} />
      ) : null}
      <History earnings={earnings} />
    </div>
  );
}

function Totals({ earnings }: { earnings: AgencyEarnings }) {
  const { currency } = earnings;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Figure
        label="Available now"
        value={formatMoneyCents(earnings.availableCents, currency)}
        hint={
          /*
           * A NEGATIVE balance is not a payout waiting to happen.
           *
           * It used to say "Paid out automatically on 25 Oct" underneath a
           * figure like −$103.50, which reads as a promise to send money
           * the agency does not have. What is actually true is the
           * opposite: it comes OUT of the next settlement, and nothing is
           * charged to their bank.
           */
          earnings.availableCents < 0
            ? "Taken out of your next settlement — nothing is charged to your bank"
            : `Paid out automatically on ${formatDateTime(earnings.nextPayoutAt)}`
        }
        emphasis
      />
      <Figure
        label="On hold"
        value={formatMoneyCents(earnings.heldCents, currency)}
        hint={
          earnings.held.length > 0
            ? "Released once free cancellation closes"
            : "Nothing waiting"
        }
      />
      <Figure
        label="Still to come"
        value={formatMoneyCents(earnings.pendingCents, currency)}
        hint="From rentals under way, paid when they settle"
      />
    </div>
  );
}

/**
 * Why each held amount is waiting, and until when.
 *
 * The date is the renter's free-cancellation deadline: until it passes they
 * can still cancel at no cost, and the advance would have to go back. It is
 * spelled out rather than summarised because "your money is held" with no
 * date reads as something going wrong.
 */
function HeldList({
  held,
  currency,
}: {
  held: HeldEarning[];
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">On hold</CardTitle>
        <CardDescription>
          Your share of a confirmed booking, waiting for the renter&apos;s
          free-cancellation window to close. It becomes available on its own —
          there is nothing to do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {held.map((entry) => (
          <div
            key={`${entry.bookingId ?? "unassigned"}-${entry.availableAt}`}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatMoneyCents(entry.amountCents, currency)}
              </span>
              {entry.bookingId ? (
                <Link
                  href={`/agency/requests/${entry.bookingId}`}
                  className="ml-2 text-sm text-primary underline-offset-4 hover:underline"
                >
                  View booking
                </Link>
              ) : null}
            </div>
            <span className="text-sm text-muted-foreground">
              Available {formatDateTime(entry.availableAt)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** The three ranges the history can be read at, in the order they are offered. */
const RANGES = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function History({ earnings }: { earnings: AgencyEarnings }) {
  const [range, setRange] = useState<RangeKey>("day");
  const buckets = earnings.history[range];

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Earnings history</CardTitle>
          <CardDescription>
            What you made, newest first. Payouts to your bank are not counted —
            moving money you already earned is not earning it again.
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-1">
          {RANGES.map((option) => (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant={range === option.key ? "default" : "outline"}
              onClick={() => setRange(option.key)}
              aria-pressed={range === option.key}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing yet. Your first settled booking will show up here.
          </p>
        ) : (
          <HistoryBars buckets={buckets} currency={earnings.currency} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * A bar per period, scaled against the best one in view.
 *
 * The bar is decoration on top of a figure that is always readable: the
 * amount is text, so a row still says what it means at any width and to a
 * screen reader. Negative periods (a refund outweighing earnings) draw no
 * bar — a backwards bar reads as a bigger number, not a smaller one.
 */
function HistoryBars({
  buckets,
  currency,
}: {
  buckets: EarningsBucket[];
  currency: string;
}) {
  const peak = Math.max(...buckets.map((b) => Math.abs(b.earnedCents)), 1);
  return (
    <ul className="space-y-2">
      {buckets.map((bucket) => {
        const width = Math.max(
          0,
          Math.round((bucket.earnedCents / peak) * 100),
        );
        return (
          <li key={bucket.periodStart} className="space-y-1">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                {formatIsoDate(bucket.periodStart)}
              </span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  bucket.earnedCents < 0
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {formatMoneyCents(bucket.earnedCents, currency)}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Figure({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span
          className={cn(
            "text-3xl font-bold tabular-nums tracking-tight",
            emphasis ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
