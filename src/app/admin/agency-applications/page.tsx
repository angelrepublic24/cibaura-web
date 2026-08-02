"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
import type {
  AgencyApplication,
  AgencyDocument,
} from "@/features/agencies/api";
import type { AgencyVerificationStatus } from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * /admin/agency-applications — the platform KYC review queue (ADR-0004).
 *
 * Admins pick a status filter (pending by default), open an application to read
 * its full KYC block + view uploaded documents, then Verify or Reject with a
 * reason. Every mutation invalidates the applications subtree so the list and
 * the open detail both refresh. The /admin layout already gates platform_admin;
 * we wrap again defensively so this page renders nothing useful otherwise.
 */

type StatusFilter = Extract<
  AgencyVerificationStatus,
  "pending" | "verified" | "rejected"
>;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  business_registration: "Business registration",
  owner_id: "Owner ID",
  other: "Other",
};

/** ISO datetime (createdAt/uploadedAt) → "Aug 1, 2026". */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: AgencyVerificationStatus }) {
  if (status === "verified")
    return <Badge variant="success">Verified</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default function AdminAgencyApplicationsPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: adminKeys.applications(status),
    queryFn: () => AdminApi.listApplications(status),
  });

  const applications = listQuery.data ?? [];

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground">
              Agency applications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review agency KYC submissions, inspect their documents, then verify
              or reject each application.
            </p>
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="status-filter" className="text-xs">
              Status
            </Label>
            <Select
              id="status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setSelectedId(null);
              }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          {/* ── List ──────────────────────────────────────────────────── */}
          <div>
            {listQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : listQuery.isError ? (
              <ErrorState
                title="Could not load applications"
                message={(listQuery.error as Error).message}
                onRetry={() => listQuery.refetch()}
              />
            ) : applications.length === 0 ? (
              <EmptyState
                title={`No ${status} applications`}
                description="Nothing to review here right now."
                className="py-12"
              />
            ) : (
              <ul className="space-y-3">
                {applications.map((app) => {
                  const selected = app.id === selectedId;
                  return (
                    <li key={app.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(app.id)}
                        aria-current={selected}
                        className={cn(
                          "w-full rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-accent-soft"
                            : "border-border bg-surface hover:border-border-strong",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {app.name}
                          </span>
                          <StatusBadge status={app.verificationStatus} />
                        </div>
                        <dl className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                          <div className="flex gap-1">
                            <dt className="shrink-0">Legal name:</dt>
                            <dd className="text-foreground/80">
                              {app.kyc.legalName || "—"}
                            </dd>
                          </div>
                          <div className="flex gap-1">
                            <dt className="shrink-0">Tax ID:</dt>
                            <dd className="text-foreground/80">
                              {app.kyc.taxId || "—"}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {app.documentCount}{" "}
                            {app.documentCount === 1 ? "document" : "documents"}
                          </span>
                          <span>{fmtDate(app.createdAt)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Detail ────────────────────────────────────────────────── */}
          <div>
            {selectedId ? (
              // key remounts the detail per selection, resetting reject/reason state.
              <ApplicationDetail key={selectedId} id={selectedId} />
            ) : (
              <Card>
                <CardContent className="py-16">
                  <p className="text-center text-sm text-muted-foreground">
                    Select an application to review its KYC details and
                    documents.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}

function ApplicationDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const detailQuery = useQuery({
    queryKey: adminKeys.application(id),
    queryFn: () => AdminApi.getApplication(id),
  });

  // Invalidates every applications list (all filters) AND this detail.
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "applications"] });

  const verify = useMutation({
    mutationFn: () => AdminApi.verifyApplication(id),
    onSuccess: () => {
      invalidate();
    },
  });

  const reject = useMutation({
    mutationFn: () => AdminApi.rejectApplication(id, reason.trim()),
    onSuccess: () => {
      invalidate();
      setRejecting(false);
      setReason("");
    },
  });

  const viewDoc = useMutation({
    mutationFn: (docId: string) => AdminApi.downloadDocument(id, docId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Revoke later so the opened tab has time to load the bytes.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  });

  if (detailQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <LoadingState label="Loading application…" />
        </CardContent>
      </Card>
    );
  }
  if (detailQuery.isError) {
    return (
      <ErrorState
        title="Could not load application"
        message={(detailQuery.error as Error).message}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const app = detailQuery.data as AgencyApplication;
  const busy = verify.isPending || reject.isPending;

  const kycRows: { label: string; value: string | null }[] = [
    { label: "Legal name", value: app.kyc.legalName },
    { label: "Tax ID", value: app.kyc.taxId },
    { label: "Owner name", value: app.kyc.ownerName },
    { label: "Owner ID number", value: app.kyc.ownerIdNumber },
    { label: "Phone", value: app.kyc.phone },
    { label: "Address", value: app.kyc.address },
  ];

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl text-foreground">
                {app.name}
              </h2>
              <StatusBadge status={app.verificationStatus} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">/{app.slug}</p>
          </div>
          <span className="text-xs text-muted-foreground">
            Applied {fmtDate(app.createdAt)}
          </span>
        </div>

        {app.description ? (
          <p className="text-sm text-foreground">{app.description}</p>
        ) : null}

        {/* KYC block */}
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            KYC details
          </h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {kycRows.map((row) => (
              <div key={row.label} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-sm text-foreground">{row.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Documents */}
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            Documents{" "}
            <span className="font-normal text-muted-foreground">
              ({app.documents.length})
            </span>
          </h3>
          <div className="mt-3">
            {app.documents.length === 0 ? (
              <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                No documents were uploaded with this application.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
                {app.documents.map((doc: AgencyDocument) => {
                  const loading =
                    viewDoc.isPending && viewDoc.variables === doc.id;
                  return (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {doc.filename}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {DOC_TYPE_LABELS[doc.type] ?? doc.type} ·{" "}
                          {fmtDate(doc.uploadedAt)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => viewDoc.mutate(doc.id)}
                      >
                        {loading ? "Opening…" : "View"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {viewDoc.isError ? (
              <p className="mt-2 text-sm text-destructive">
                {(viewDoc.error as Error).message}
              </p>
            ) : null}
          </div>
        </section>

        {/* Prior decision reason (if any) */}
        {app.verificationStatus === "rejected" && app.verificationReason ? (
          <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3.5 py-3">
            <p className="text-xs font-medium text-red-800">
              Rejection reason
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              {app.verificationReason}
            </p>
          </div>
        ) : null}

        {/* Actions */}
        <section className="border-t border-border pt-5">
          {app.verificationStatus === "pending" ? (
            <div className="space-y-3">
              {!rejecting ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => verify.mutate()}
                    disabled={busy}
                  >
                    {verify.isPending ? "Verifying…" : "Verify agency"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      verify.reset();
                      setRejecting(true);
                    }}
                    disabled={busy}
                  >
                    Reject…
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="reject-reason">Reason for rejection</Label>
                    <Textarea
                      id="reject-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain what is missing or invalid so the agency can fix and re-apply…"
                    />
                    <p className="text-xs text-muted-foreground">
                      This reason is shown to the agency. A reason is required.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      disabled={reason.trim().length < 3 || reject.isPending}
                      onClick={() => reject.mutate()}
                    >
                      {reject.isPending ? "Rejecting…" : "Confirm rejection"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={reject.isPending}
                      onClick={() => {
                        setRejecting(false);
                        setReason("");
                        reject.reset();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {verify.isError ? (
                <p className="text-sm text-destructive">
                  {(verify.error as Error).message}
                </p>
              ) : null}
              {reject.isError ? (
                <p className="text-sm text-destructive">
                  {(reject.error as Error).message}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>This application is</span>
              <StatusBadge status={app.verificationStatus} />
              <span>— no further action is needed.</span>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
