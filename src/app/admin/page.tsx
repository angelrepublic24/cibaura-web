"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  ClipboardList,
  UserCheck,
  Wallet,
} from "lucide-react";
import { AdminApi, adminKeys, type AdminOverview } from "@/features/admin/api";
import { RoleGuard } from "@/shared/auth/guard";
import {
  EmptyState,
  ErrorState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatMoneyCents } from "@/shared/utils/money";

/**
 * /admin — platform overview. This is the console's "report" home: a
 * read-only snapshot of agencies, orders (bookings), platform revenue and the
 * two review queues, pulled from GET /admin/overview. The old commission form
 * that used to live here now lives under /admin/settings.
 *
 * Every number is server-computed (money is integer cents rendered $X.XX);
 * the page only formats and links out to the drill-down screens.
 */

/** Booking lifecycle states, in lifecycle order, for the by-state breakdown. */
const STATE_LABELS: {
  key: keyof AdminOverview["bookings"]["byState"];
  label: string;
}[] = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "active", label: "Active" },
  { key: "returned", label: "Returned" },
  { key: "settled", label: "Settled" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired", label: "Expired" },
];

export default function AdminOverviewPage() {
  const query = useQuery({
    queryKey: adminKeys.overview(),
    queryFn: AdminApi.getOverview,
  });

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">
            Platform overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A live snapshot of agencies, orders, revenue and the review queues
            across the whole platform.
          </p>
        </div>

        {query.isLoading ? (
          <OverviewSkeleton />
        ) : query.isError ? (
          <div className="mt-6">
            <ErrorState
              title="Could not load the overview"
              message={(query.error as Error).message}
              onRetry={() => query.refetch()}
            />
          </div>
        ) : (
          <OverviewBody data={query.data as AdminOverview} />
        )}
      </div>
    </RoleGuard>
  );
}

function OverviewBody({ data }: { data: AdminOverview }) {
  const { agencies, bookings, revenue, pending } = data;

  // A brand-new platform with nothing recorded yet: guide the admin instead of
  // rendering a wall of zeros with no context.
  const isEmpty =
    agencies.total === 0 &&
    bookings.thisMonth === 0 &&
    bookings.active === 0 &&
    revenue.allTimeCents === 0 &&
    pending.applications === 0 &&
    pending.verifications === 0;

  if (isEmpty) {
    return (
      <div className="mt-6">
        <EmptyState
          title="Nothing to report yet"
          description="Once agencies are onboarded and bookings start flowing, their metrics will appear here."
          action={
            <Link
              href="/admin/agency-applications"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Review agency applications
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </div>
    );
  }

  const pendingTotal = pending.applications + pending.verifications;

  return (
    <div className="mt-6 space-y-6">
      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Agencies */}
        <MetricCard
          href="/admin/agencies"
          icon={Building2}
          label="Agencies"
          value={agencies.total.toLocaleString()}
        >
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="success">{agencies.verified} verified</Badge>
            <Badge variant="warning">{agencies.pending} pending</Badge>
            {agencies.rejected > 0 ? (
              <Badge variant="secondary">{agencies.rejected} rejected</Badge>
            ) : null}
          </div>
        </MetricCard>

        {/* Orders */}
        <MetricCard
          href="/admin/orders"
          icon={ClipboardList}
          label="Orders today"
          value={bookings.today.toLocaleString()}
        >
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {bookings.thisMonth.toLocaleString()}
            </span>{" "}
            this month ·{" "}
            <span className="font-medium text-foreground">
              {bookings.active.toLocaleString()}
            </span>{" "}
            active
          </p>
        </MetricCard>

        {/* Revenue */}
        <MetricCard
          href="/admin/revenue"
          icon={Wallet}
          label="Platform balance"
          value={formatMoneyCents(
            revenue.platformBalanceCents,
            revenue.currency,
          )}
        >
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatMoneyCents(revenue.thisMonthCents, revenue.currency)}
            </span>{" "}
            this month
          </p>
        </MetricCard>

        {/* Pending queues */}
        <MetricCard
          href="/admin/agency-applications"
          icon={ClipboardCheck}
          label="Pending review"
          value={pendingTotal.toLocaleString()}
        >
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {pending.applications.toLocaleString()}
            </span>{" "}
            applications ·{" "}
            <span className="font-medium text-foreground">
              {pending.verifications.toLocaleString()}
            </span>{" "}
            KYC
          </p>
        </MetricCard>
      </div>

      {/* ── Orders by state + review queues ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Orders by state
              </h2>
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {STATE_LABELS.map(({ key, label }) => (
                <div key={key} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">
                    {bookings.byState[key].toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Review queues
            </h2>
            <ul className="mt-4 space-y-2">
              <QueueRow
                href="/admin/agency-applications"
                icon={ClipboardCheck}
                label="Agency applications"
                count={pending.applications}
              />
              <QueueRow
                href="/admin/verification"
                icon={UserCheck}
                label="Customer KYC"
                count={pending.verifications}
              />
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick links ──────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink href="/admin/agencies" icon={Building2} label="Agencies" />
        <QuickLink href="/admin/orders" icon={ClipboardList} label="Orders" />
        <QuickLink href="/admin/revenue" icon={Wallet} label="Revenue" />
        <QuickLink
          href="/admin/agency-applications"
          icon={ClipboardCheck}
          label="Applications"
        />
      </div>
    </div>
  );
}

/** A headline metric that links to its drill-down screen. */
function MetricCard({
  href,
  icon: Icon,
  label,
  value,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-colors group-hover:border-border-strong">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
          {children}
        </CardContent>
      </Card>
    </Link>
  );
}

/** One row of the review-queues card. */
function QueueRow({
  href,
  icon: Icon,
  label,
  count,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong"
      >
        <span className="flex items-center gap-2 text-sm text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        {count > 0 ? (
          <Badge variant="warning">{count.toLocaleString()}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Clear</span>
        )}
      </Link>
    </li>
  );
}

/** A compact secondary navigation tile. */
function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
