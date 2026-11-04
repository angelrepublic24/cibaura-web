"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";

import { useAdminReport } from "@/modules/moderation/hooks/moderation.hook";
import {
  isReportDecided,
  reportReasonLabel,
} from "@/modules/moderation/helpers/moderation.helper";
import { ReportResolveDialog } from "@/modules/moderation/components/report-resolve-dialog";
import { ReportStatusBadge } from "@/modules/moderation/components/report-status-badge";
import type { AdminReportDetail } from "@/modules/moderation/types/moderation.types";
import { getErrorMessage } from "@/shared/api/errors";
import { RoleGuard } from "@/shared/auth/guard";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { formatDateTime } from "@/shared/utils/dates";

/**
 * /admin/reports/[id] — one report, and where it gets decided.
 *
 * THIS ROUTE IS LOAD-BEARING FOR THE BACKEND'S ALERT: the notification sent
 * when a report is filed links straight to `/admin/reports/<id>`, so this
 * page existing is what keeps that link from being a dead end.
 *
 * ⚠️ PRIVACY — for a reported chat message, `targetLabel` carries the actual
 * MESSAGE TEXT (truncated server-side). It is evidence an admin needs to
 * judge "offensive", but it is two users' private conversation appearing on a
 * new surface: it must never be logged, never passed to an error reporter and
 * never put in a URL. Nothing on this page does any of those — keep it that
 * way.
 */
export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAdminReport(id);

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div className="space-y-6">
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>

        {query.isPending ? (
          <LoadingState label="Loading report…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load this report"
            message={getErrorMessage(query.error, "Please try again.")}
            onRetry={() => query.refetch()}
          />
        ) : (
          <ReportDetail report={query.data} />
        )}
      </div>
    </RoleGuard>
  );
}

function ReportDetail({ report }: { report: AdminReportDetail }) {
  const [resolveOpen, setResolveOpen] = useState(false);
  const decided = isReportDecided(report.status);
  // `pendingReportsOnTarget` counts THIS one too, so >1 means others are
  // waiting on the same object.
  const alsoPending = report.pendingReportsOnTarget - 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl capitalize text-foreground">
              Reported {report.targetTypeLabel}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {reportReasonLabel(report.reason)} · reported by{" "}
              {report.reporter.name} · {formatDateTime(report.createdAt)}
            </p>
          </div>
          <ReportStatusBadge status={report.status} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What was reported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">
                {targetLabelHeading(report)}
              </p>
              {report.targetLabel ? (
                <p className="mt-1 whitespace-pre-line break-words rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-foreground">
                  {report.targetLabel}
                </p>
              ) : (
                /* The backend sends null when the object is gone — deleted,
                   or a listing pulled since. Say so: there is nothing left to
                   look at, which is itself part of the decision. */
                <p className="mt-1 text-muted-foreground">
                  This no longer exists — it was removed after the report was
                  filed.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Reporter&apos;s description
              </p>
              {report.detail ? (
                <p className="mt-1 whitespace-pre-line break-words rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-foreground">
                  {report.detail}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  They picked a reason and added nothing — which is allowed.
                </p>
              )}
            </div>

            {/* No link: there is no admin route keyed by these ids, and a
                link that 404s is worse than an id an admin can copy. */}
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {report.targetType} id
                </dt>
                <dd className="break-all font-mono text-xs text-foreground">
                  {report.targetId}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Reporter id</dt>
                <dd className="break-all font-mono text-xs text-foreground">
                  {report.reporter.id}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {alsoPending > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Not the only one
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {alsoPending} other report{alsoPending === 1 ? "" : "s"} about
              this same {report.targetTypeLabel}{" "}
              {alsoPending === 1 ? "is" : "are"} still waiting. They are
              separate rows in the queue and each needs its own decision —
              deciding this one does not close them.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flag className="h-4 w-4 text-primary" />
              Decision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {report.resolutionNote ? (
              <div>
                <p className="text-xs text-muted-foreground">
                  {/* `reviewing` keeps any note already written, so this is
                      not necessarily a closing note. */}
                  {report.resolvedAt
                    ? `Decided ${formatDateTime(report.resolvedAt)}`
                    : "Note so far"}
                </p>
                <p className="mt-1 whitespace-pre-line break-words rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-foreground">
                  {report.resolutionNote}
                </p>
              </div>
            ) : report.resolvedAt ? (
              <p className="text-muted-foreground">
                Decided {formatDateTime(report.resolvedAt)}.
              </p>
            ) : null}

            {report.resolvedByUserId ? (
              <div>
                <p className="text-xs text-muted-foreground">
                  Last moved by (admin id)
                </p>
                <p className="break-all font-mono text-xs text-foreground">
                  {report.resolvedByUserId}
                </p>
              </div>
            ) : null}

            {decided ? (
              <p className="text-muted-foreground">
                This report is closed and cannot be reopened. If the same
                thing happens again, the reporter can file a new one.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {report.status === "open"
                    ? "Nobody has picked this up yet. Take it so another admin does not duplicate the work, or decide it now."
                    : "Somebody has taken this. Action or dismiss it with a note when you have decided."}
                </p>
                <Button onClick={() => setResolveOpen(true)}>
                  {report.status === "open" ? "Take or decide…" : "Decide…"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Actioning does not suspend anyone by itself — do that from
                  the agency or user screens and record it in the note.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ReportResolveDialog
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        report={report}
      />
    </div>
  );
}

/** What `targetLabel` actually is, per target kind. */
function targetLabelHeading(report: AdminReportDetail): string {
  switch (report.targetType) {
    case "car":
      return "The listing";
    case "agency":
      return "The agency";
    case "user":
      return "The person";
    case "message":
      // Named so nobody mistakes private chat text for a title.
      return "The message (private conversation — evidence only)";
  }
}
