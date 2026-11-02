"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useAdminReports } from "@/modules/moderation/hooks/moderation.hook";
import {
  reportReasonLabel,
  reportStatusLabel,
} from "@/modules/moderation/helpers/moderation.helper";
import { ReportStatusBadge } from "@/modules/moderation/components/report-status-badge";
import { REPORT_STATUSES } from "@/modules/moderation/schema/moderation.schema";
import type {
  AdminReport,
  ReportStatus,
} from "@/modules/moderation/types/moderation.types";
import { getErrorMessage } from "@/shared/api/errors";
import { RoleGuard } from "@/shared/auth/guard";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDateTime } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

/**
 * /admin/reports — the moderation queue. THIS is what makes reporting worth
 * anything: without a human reading it, every report dialog in the app is a
 * form that writes to a table nobody opens.
 *
 * Defaults to `open` (the work), with every other status one tab away. Rows
 * open the detail, which is where the reported thing is named and the
 * decision is taken — the count of other pending reports on the same object
 * lives there too, because the backend has no index to produce it per row.
 */

const PAGE_SIZE = 20;
type StatusFilter = "" | ReportStatus;
/** Open first — it is the queue. Then taken, then the decided ones, then All. */
const FILTERS: StatusFilter[] = [...REPORT_STATUSES, ""];

function filterLabel(status: StatusFilter): string {
  return status === "" ? "All" : reportStatusLabel(status);
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [page, setPage] = useState(1);

  const query = { status: status || undefined, page, pageSize: PAGE_SIZE };
  const list = useAdminReports(query);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Users report listings, agencies, people and chat messages from
            across the app. Take a report to show you are on it, then action
            or dismiss it with a note. The person who reported it is never
            notified and cannot see this queue.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Report status"
          className="mt-6 inline-flex flex-wrap overflow-hidden rounded-md border border-border"
        >
          {FILTERS.map((s, i) => (
            <button
              key={s || "all"}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 text-sm transition-colors",
                i > 0 && "border-l border-border",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {filterLabel(s)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {list.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState
              title="Could not load reports"
              message={getErrorMessage(list.error, "Please try again.")}
              onRetry={() => list.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={
                status
                  ? `No ${filterLabel(status).toLowerCase()} reports`
                  : "No reports"
              }
              description={
                status === "open"
                  ? "Nothing is waiting for a decision right now."
                  : "Nothing to show for this status."
              }
              className="py-12"
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {total} report{total === 1 ? "" : "s"}
              </p>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table
                    className={cn(
                      "w-full min-w-[880px] border-collapse text-sm",
                      list.isFetching && "opacity-60 transition-opacity",
                    )}
                  >
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">What</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Detail</th>
                        <th className="px-4 py-3 font-medium">Reported by</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Filed</th>
                        <th className="px-4 py-3 font-medium">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r) => (
                        <ReportRow key={r.id} report={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {pageCount > 1 ? (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || list.isFetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pageCount || list.isFetching}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

function ReportRow({ report: r }: { report: AdminReport }) {
  return (
    <tr className="align-top transition-colors hover:bg-muted/40">
      {/* `targetTypeLabel` arrives ready to paint ("car listing", "chat
          message") — the readable name of the thing itself costs an extra
          query and lives on the detail. */}
      <td className="px-4 py-3 font-medium capitalize text-foreground">
        {r.targetTypeLabel}
      </td>
      <td className="px-4 py-3 text-foreground">
        {reportReasonLabel(r.reason)}
      </td>
      {/*
        Truncated to one line: the queue is scanned, not read, and a 1000-char
        detail would push every other column off the screen. The full text is
        on the detail page.
      */}
      <td className="max-w-[260px] px-4 py-3 text-muted-foreground">
        {r.detail ? (
          <span className="line-clamp-1" title={r.detail}>
            {r.detail}
          </span>
        ) : (
          <span className="text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-foreground">{r.reporter.name}</td>
      <td className="px-4 py-3">
        <ReportStatusBadge status={r.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatDateTime(r.createdAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Link
          href={`/admin/reports/${r.id}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Review
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}
