"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  AdminApi,
  adminKeys,
  type AdminRevenueEntry,
  type AdminRevenueQuery,
} from "@/features/admin/api";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { formatMoneyCents } from "@/shared/utils/money";
import { cn } from "@/lib/utils";

/**
 * /admin/revenue — platform earnings. The platform wallet (a singleton
 * WalletAccount, ownerType = PLATFORM) is credited each booking's
 * commissionCents on settle; its balance + ledger ARE the platform's revenue.
 *
 * The three header totals (balance / this-month / all-time) come straight from
 * the wallet and are NOT affected by the date filter — the filter narrows only
 * the ledger list below (half-open [from, to), `to` exclusive), mirroring the
 * backend GET /admin/revenue contract.
 */
export default function AdminRevenuePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Half-open range: `from` must be strictly before `to`. On an invalid range
  // we query unfiltered and surface a warning instead of firing a query that
  // can only ever return nothing.
  const rangeInvalid = from !== "" && to !== "" && from >= to;
  const effective: AdminRevenueQuery = rangeInvalid
    ? {}
    : { from: from || undefined, to: to || undefined };
  const rangeApplied = !rangeInvalid && (from !== "" || to !== "");

  const query = useQuery({
    queryKey: adminKeys.revenue(effective),
    queryFn: () => AdminApi.getRevenue(effective),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Revenue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform earnings — commission credited to the platform wallet on
          every settled booking.
        </p>
      </div>

      {/* Date filter (narrows the ledger only; totals are all-time) */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              className="w-[170px]"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">
              To <span className="text-muted-foreground">(exclusive)</span>
            </Label>
            <Input
              id="to"
              type="date"
              className="w-[170px]"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {from || to ? (
            <Button
              variant="outline"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>
          ) : null}
          {query.isFetching && !query.isLoading ? (
            <span className="pb-2.5 text-xs text-muted-foreground">
              Updating…
            </span>
          ) : null}
          {rangeInvalid ? (
            <p className="w-full text-sm text-red-600">
              “From” must be before “To”. Showing all entries until the range is
              fixed.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {query.isLoading ? (
        <LoadingState label="Loading revenue…" />
      ) : query.isError ? (
        <ErrorState
          title="Could not load revenue"
          message={query.error.message}
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        <>
          {/* Totals (straight from the platform wallet; not date-filtered) */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Platform balance"
              value={formatMoneyCents(
                query.data.balanceCents,
                query.data.currency,
              )}
              hint="Current platform wallet balance"
            />
            <StatCard
              label="This month"
              value={formatMoneyCents(
                query.data.thisMonthCents,
                query.data.currency,
              )}
              hint="Commission earned this month"
            />
            <StatCard
              label="All time"
              value={formatMoneyCents(
                query.data.allTimeCents,
                query.data.currency,
              )}
              hint="Total commission earned"
            />
          </div>

          {/* Ledger */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Ledger</h2>
              <span className="text-xs text-muted-foreground">
                {query.data.entries.length}{" "}
                {query.data.entries.length === 1 ? "entry" : "entries"}
                {rangeApplied ? " in range" : ""}
              </span>
            </div>

            {query.data.entries.length === 0 ? (
              <EmptyState
                title="No ledger entries"
                description={
                  rangeApplied
                    ? "No platform earnings fall in this date range."
                    : "The platform wallet has no entries yet — commission appears here as bookings settle."
                }
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {query.data.entries.map((entry) => (
                      <LedgerRow
                        key={entry.id}
                        entry={entry}
                        currency={query.data.currency}
                      />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** ISO datetime → "Aug 1, 2026, 3:04 PM". */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LedgerRow({
  entry,
  currency,
}: {
  entry: AdminRevenueEntry;
  currency: string;
}) {
  const credit = entry.amountCents >= 0;
  const Icon = credit ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            credit
              ? "bg-success-soft text-success"
              : "bg-red-50 text-red-700",
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {entry.description}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{fmtDateTime(entry.createdAt)}</span>
            {entry.bookingId ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href="/admin/orders"
                  className="font-medium text-primary hover:underline"
                >
                  Booking #{entry.bookingId.slice(0, 8)}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          credit ? "text-success" : "text-red-700",
        )}
      >
        {credit ? "+" : "−"}
        {formatMoneyCents(Math.abs(entry.amountCents), currency)}
      </span>
    </li>
  );
}
