"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VerificationApi, verificationKeys } from "@/features/verification/api";
import type {
  CustomerDocument,
  CustomerVerificationAdmin,
  CustomerVerificationStatus,
} from "@/shared/types/domain";
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
 * /admin/verification — the customer identity/licence review queue (ADR-0004).
 *
 * Admins pick a status filter (pending by default), open a customer to read
 * their licence + view uploaded ID/licence photos, then Verify or Reject with a
 * reason. Verifying an EXPIRED licence is blocked server-side (400) — we mirror
 * that by disabling Verify and showing why. Every mutation invalidates the
 * verification subtree so the list and the open detail both refresh.
 */

type StatusFilter = CustomerVerificationStatus;

// Only PERSISTED statuses are filterable. "unverified" is a synthetic
// /verification/me state for customers who never submitted (no row exists), so
// it can never match a server query — offering it would be a dead filter.
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  id_front: "ID — front",
  id_back: "ID — back",
  license_front: "Licence — front",
  license_back: "Licence — back",
};

/** ISO datetime → "Aug 1, 2026"; YYYY-MM-DD licence dates render the same. */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: CustomerVerificationStatus }) {
  if (status === "verified") return <Badge variant="success">Verified</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive">Rejected</Badge>;
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  return <Badge variant="secondary">Unverified</Badge>;
}

export default function AdminVerificationPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: verificationKeys.customers(status),
    queryFn: () => VerificationApi.listCustomers(status),
  });

  const customers = listQuery.data ?? [];

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground">
              Customer verification
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review customer identity + driver&apos;s licence submissions,
              inspect their photos, then verify or reject each one.
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
                title="Could not load customers"
                message={(listQuery.error as Error).message}
                onRetry={() => listQuery.refetch()}
              />
            ) : customers.length === 0 ? (
              <EmptyState
                title={`No ${status} customers`}
                description="Nothing to review here right now."
                className="py-12"
              />
            ) : (
              <ul className="space-y-3">
                {customers.map((c) => {
                  const selected = c.userId === selectedId;
                  return (
                    <li key={c.userId}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.userId)}
                        aria-current={selected}
                        className={cn(
                          "w-full rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-accent-soft"
                            : "border-border bg-surface hover:border-border-strong",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate font-medium text-foreground">
                            {c.name}
                          </span>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {c.email}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            {c.documentCount}{" "}
                            {c.documentCount === 1 ? "photo" : "photos"}
                            {c.licenseExpired ? (
                              <Badge variant="destructive">Licence expired</Badge>
                            ) : null}
                          </span>
                          <span>{fmtDate(c.createdAt)}</span>
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
              <CustomerDetail key={selectedId} userId={selectedId} />
            ) : (
              <Card>
                <CardContent className="py-16">
                  <p className="text-center text-sm text-muted-foreground">
                    Select a customer to review their licence and photos.
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

function CustomerDetail({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const detailQuery = useQuery({
    queryKey: verificationKeys.customer(userId),
    queryFn: () => VerificationApi.getCustomer(userId),
  });

  // Invalidate every customers list (all filters) AND this detail.
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: verificationKeys.all });

  const verify = useMutation({
    mutationFn: () => VerificationApi.verifyCustomer(userId),
    onSuccess: () => invalidate(),
  });

  const reject = useMutation({
    mutationFn: () => VerificationApi.rejectCustomer(userId, reason.trim()),
    onSuccess: () => {
      invalidate();
      setRejecting(false);
      setReason("");
    },
  });

  const viewDoc = useMutation({
    mutationFn: (docId: string) =>
      VerificationApi.downloadDocument(userId, docId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  });

  if (detailQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <LoadingState label="Loading customer…" />
        </CardContent>
      </Card>
    );
  }
  if (detailQuery.isError) {
    return (
      <ErrorState
        title="Could not load customer"
        message={(detailQuery.error as Error).message}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const c = detailQuery.data as CustomerVerificationAdmin;
  const busy = verify.isPending || reject.isPending;

  const rows: { label: string; value: string | null; alert?: boolean }[] = [
    { label: "Name", value: c.name },
    { label: "Email", value: c.email },
    { label: "Licence number", value: c.licenseNumber },
    {
      label: "Licence expiry",
      value: fmtDate(c.licenseExpiry),
      alert: c.licenseExpired,
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl text-foreground">{c.name}</h2>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.email}</p>
          </div>
          <span className="text-xs text-muted-foreground">
            Submitted {fmtDate(c.createdAt)}
          </span>
        </div>

        {/* Expired-licence warning */}
        {c.licenseExpired ? (
          <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            This driver&apos;s licence is expired — it cannot be verified. Ask
            the customer to submit a valid licence.
          </div>
        ) : null}

        {/* Details */}
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            Licence details
          </h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd
                  className={cn(
                    "text-sm",
                    row.alert ? "font-medium text-red-600" : "text-foreground",
                  )}
                >
                  {row.value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Documents */}
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            Photos{" "}
            <span className="font-normal text-muted-foreground">
              ({c.documents.length})
            </span>
          </h3>
          <div className="mt-3">
            {c.documents.length === 0 ? (
              <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                No photos were uploaded yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
                {c.documents.map((doc: CustomerDocument) => {
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

        {/* Prior rejection reason */}
        {c.status === "rejected" && c.rejectionReason ? (
          <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3.5 py-3">
            <p className="text-xs font-medium text-red-800">Rejection reason</p>
            <p className="mt-0.5 text-sm text-red-700">{c.rejectionReason}</p>
          </div>
        ) : null}

        {/* Actions — verify/reject are available unless already verified. */}
        <section className="border-t border-border pt-5">
          {c.status !== "verified" ? (
            <div className="space-y-3">
              {!rejecting ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => verify.mutate()}
                    disabled={busy || c.licenseExpired}
                  >
                    {verify.isPending ? "Verifying…" : "Verify customer"}
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
                      placeholder="Explain what is missing or invalid (blurry photo, name mismatch, expired licence…) so the customer can fix and re-submit."
                    />
                    <p className="text-xs text-muted-foreground">
                      This reason is shown to the customer. A reason is required.
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
              <span>This customer is</span>
              <StatusBadge status={c.status} />
              <span>— they are eligible to rent.</span>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
