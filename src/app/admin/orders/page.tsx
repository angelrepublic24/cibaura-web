"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
import type { AdminBookingRow } from "@/features/admin/api";
import { BOOKING_STATES, type BookingState } from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatMoneyCents } from "@/shared/utils/money";
import { businessTodayIso, formatIsoDate } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

/**
 * /admin/orders — platform-wide bookings across every agency.
 *
 * Admins pick a half-open date range [from, to) (defaults to the current
 * business month) and an optional state, then page through the matching
 * bookings. Each row shows agency, customer, car, the rental window, a state
 * badge, the customer total and the platform's commission cut. A small header
 * summary reports the match count and the totals for the visible page.
 *
 * Money is INTEGER CENTS from the API — the client only formats it.
 * The /admin layout already gates platform_admin; we wrap again defensively.
 */

const PAGE_SIZE = 20;

const STATE_FILTERS: { value: "" | BookingState; label: string }[] = [
  { value: "", label: "All states" },
  ...BOOKING_STATES.map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
];

/** [first-of-this-month, first-of-next-month) in the business timezone. */
function currentMonthRange(): { from: string; to: string } {
  const [y, m] = businessTodayIso().split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { from, to };
}

/** ISO datetime (createdAt) → "Aug 1, 2026, 3:04 PM". */
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

const STATE_BADGE: Record<
  BookingState,
  "default" | "accent" | "secondary" | "success" | "warning" | "destructive"
> = {
  requested: "warning",
  accepted: "accent",
  active: "default",
  returned: "secondary",
  settled: "success",
  rejected: "destructive",
  expired: "secondary",
  cancelled: "secondary",
};

function StateBadge({ state }: { state: BookingState }) {
  return (
    <Badge variant={STATE_BADGE[state]}>
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </Badge>
  );
}

export default function AdminOrdersPage() {
  const initialRange = currentMonthRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [state, setState] = useState<"" | BookingState>("");
  const [page, setPage] = useState(1);

  const query = {
    from: from || undefined,
    to: to || undefined,
    state: state || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const listQuery = useQuery({
    queryKey: adminKeys.bookings(query),
    queryFn: () => AdminApi.listBookings(query),
    placeholderData: keepPreviousData,
  });

  const data = listQuery.data;
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  // Page-level sums (honest: labelled "this page", not a range-wide aggregate,
  // which the contract does not provide). Currency is uniform on a page.
  const pageCurrency = rows[0]?.currency ?? "USD";
  const pageTotalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const pageCommissionCents = rows.reduce(
    (sum, r) => sum + r.commissionCents,
    0,
  );

  // Any filter change resets to the first page so results stay coherent.
  const resetPage = () => setPage(1);

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every booking across all agencies. Pick a date range and state to
            narrow the list; totals show the customer price and the platform
            commission on each order.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              className="w-[160px]"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                resetPage();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">
              To <span className="text-muted-foreground">(exclusive)</span>
            </Label>
            <Input
              id="to"
              type="date"
              className="w-[160px]"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                resetPage();
              }}
            />
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="state" className="text-xs">
              State
            </Label>
            <Select
              id="state"
              value={state}
              onChange={(e) => {
                setState(e.target.value as "" | BookingState);
                resetPage();
              }}
            >
              {STATE_FILTERS.map((s) => (
                <option key={s.value || "all"} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{total}</span>{" "}
            {total === 1 ? "order" : "orders"} matched
          </span>
          {rows.length > 0 ? (
            <>
              <span className="text-muted-foreground">
                Page total{" "}
                <span className="font-medium text-foreground">
                  {formatMoneyCents(pageTotalCents, pageCurrency)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Page commission{" "}
                <span className="font-medium text-foreground">
                  {formatMoneyCents(pageCommissionCents, pageCurrency)}
                </span>
              </span>
            </>
          ) : null}
        </div>

        {/* List */}
        <div className="mt-4">
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <ErrorState
              title="Could not load orders"
              message={(listQuery.error as Error).message}
              onRetry={() => listQuery.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No orders match"
              description="Try a wider date range or a different state."
              className="py-12"
            />
          ) : (
            <ul
              className={cn(
                "space-y-3",
                listQuery.isFetching && "opacity-60 transition-opacity",
              )}
            >
              {rows.map((b) => (
                <OrderRow key={b.id} booking={b} />
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {rows.length > 0 ? (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount || listQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  );
}

function OrderRow({ booking: b }: { booking: AdminBookingRow }) {
  return (
    <li>
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
          {/* Who + what */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{b.car}</span>
              <StateBadge state={b.state} />
            </div>
            <dl className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-muted-foreground/80">Agency:</dt>
                <dd className="truncate text-foreground/90">{b.agencyName}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-muted-foreground/80">Customer:</dt>
                <dd className="truncate text-foreground/90">
                  {b.customerName}
                </dd>
              </div>
            </dl>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {formatIsoDate(b.start)} → {formatIsoDate(b.end)} · requested{" "}
              {fmtDateTime(b.createdAt)}
            </p>
          </div>

          {/* Money */}
          <div className="shrink-0 text-right">
            <p className="text-base font-semibold text-foreground">
              {formatMoneyCents(b.totalCents, b.currency)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Commission{" "}
              <span className="font-medium text-foreground/90">
                {formatMoneyCents(b.commissionCents, b.currency)}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
