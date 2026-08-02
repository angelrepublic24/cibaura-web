"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import {
  VerificationApi,
  verificationKeys,
  type SubmitVerificationInput,
} from "@/features/verification/api";
import type {
  CustomerDocumentType,
  CustomerVerification,
  CustomerVerificationStatus,
} from "@/shared/types/domain";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { businessTodayIso, formatIsoDate } from "@/shared/utils/dates";

/**
 * Customer identity verification — the surface a renter uses to become eligible
 * to book. "No licence, no service": a customer must submit a valid driver's
 * licence and upload their ID + licence photos, then an admin verifies them.
 *
 * The server is the authority — it auto-rejects an already-expired licence on
 * submit, and the booking flow re-checks the gate. This component shapes input
 * and surfaces the exact server message + the licence expiry alerts (expired /
 * expires-soon) so the customer can act before a booking is ever blocked.
 */

const REQUIRED_DOCS: {
  type: CustomerDocumentType;
  label: string;
  hint: string;
}[] = [
  {
    type: "id_front",
    label: "ID — front",
    hint: "Government ID or passport, front side. Clear and uncropped.",
  },
  {
    type: "id_back",
    label: "ID — back",
    hint: "Back side of the same ID (skip for a passport).",
  },
  {
    type: "license_front",
    label: "Driver's licence — front",
    hint: "Required. You cannot rent without a valid driver's licence.",
  },
  {
    type: "license_back",
    label: "Driver's licence — back",
    hint: "Back side of your driver's licence.",
  },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  id_front: "ID — front",
  id_back: "ID — back",
  license_front: "Licence — front",
  license_back: "Licence — back",
};

function formatUploaded(iso: string): string {
  const d = new Date(iso);
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
  if (status === "pending")
    return <Badge variant="warning">Pending review</Badge>;
  return <Badge variant="secondary">Not started</Badge>;
}

/** The status banner + licence-expiry alerts at the top of the page. */
function StatusBanner({ v }: { v: CustomerVerification }) {
  return (
    <div className="space-y-3">
      <Card
        className={
          v.status === "verified"
            ? "border-success/30 bg-success-soft"
            : v.status === "rejected"
              ? "border-red-200 bg-red-50"
              : "border-accent-soft-foreground/15 bg-accent-soft"
        }
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {v.status === "verified" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : v.status === "rejected" ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              ) : v.status === "pending" ? (
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent-soft-foreground" />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-soft-foreground" />
              )}
              <div>
                <h2 className="font-display text-lg text-foreground">
                  {v.status === "verified"
                    ? "Your identity is verified"
                    : v.status === "rejected"
                      ? "Verification rejected"
                      : v.status === "pending"
                        ? "Submitted — pending review"
                        : "Verify your identity to rent"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {v.status === "verified"
                    ? "You're all set to request bookings."
                    : v.status === "rejected"
                      ? "Fix the issue below, then re-submit your licence and photos."
                      : v.status === "pending"
                        ? "We'll review your documents shortly. You can update them any time — your progress is saved."
                        : "Submit your driver's licence details and upload your ID + licence photos. A verified identity is required to book any car."}
                </p>
              </div>
            </div>
            <StatusBadge status={v.status} />
          </div>
        </CardContent>
      </Card>

      {/* Rejection reason */}
      {v.status === "rejected" && v.rejectionReason ? (
        <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-medium">Reason: </span>
          {v.rejectionReason}
        </div>
      ) : null}

      {/* Licence expiry alerts (independent of status) */}
      {v.licenseExpired ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">Your driver&apos;s licence is expired</span>
            {v.licenseExpiry ? ` (expired ${formatIsoDate(v.licenseExpiry)})` : ""}.
            You cannot rent until you submit a valid licence.
          </span>
        </div>
      ) : v.licenseExpiresSoon ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">Your licence expires soon</span>
            {v.licenseExpiry ? ` (on ${formatIsoDate(v.licenseExpiry)}` : ""}
            {v.daysUntilExpiry != null
              ? `, in ${v.daysUntilExpiry} day${v.daysUntilExpiry === 1 ? "" : "s"})`
              : v.licenseExpiry
                ? ")"
                : ""}
            . Renew it soon — a rental that ends after your licence expires
            can&apos;t be booked.
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function VerificationPanel() {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: verificationKeys.me(),
    queryFn: VerificationApi.me,
  });

  // Licence form (prefilled from the current record once loaded).
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !meQuery.isSuccess) return;
    const v = meQuery.data.verification;
    if (v.licenseNumber) setLicenseNumber(v.licenseNumber);
    if (v.licenseExpiry) setLicenseExpiry(v.licenseExpiry);
    setPrefilled(true);
  }, [prefilled, meQuery.isSuccess, meQuery.data]);

  const submit = useMutation({
    mutationFn: (input: SubmitVerificationInput) => VerificationApi.submit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: verificationKeys.me() });
    },
  });

  const upload = useMutation({
    mutationFn: ({ file, type }: { file: File; type: CustomerDocumentType }) =>
      VerificationApi.uploadDocument(file, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: verificationKeys.me() });
    },
  });

  if (meQuery.isLoading) {
    return <LoadingState label="Loading your verification…" className="py-16" />;
  }
  if (meQuery.isError) {
    return (
      <ErrorState
        title="Could not load your verification"
        message={(meQuery.error as Error).message}
        onRetry={() => meQuery.refetch()}
      />
    );
  }

  const data = meQuery.data;
  if (!data) {
    return <LoadingState label="Loading your verification…" className="py-16" />;
  }
  const { verification: v, documents: docs } = data;
  const docByType = (t: string) => docs.find((d) => d.type === t);

  const num = licenseNumber.trim();
  // Expiry must be today or later in the BUSINESS timezone (matches the server's
  // gate). The server has the final word (and auto-rejects a past date), but we
  // block the obvious case on the same calendar day the server uses.
  const ready = num.length >= 3 && licenseExpiry >= businessTodayIso();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || submit.isPending) return;
    submit.mutate({ licenseNumber: num, licenseExpiry });
  }

  function onPick(
    type: CustomerDocumentType,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    upload.mutate({ file, type });
  }

  return (
    <div className="space-y-6">
      <StatusBanner v={v} />

      {/* Licence details */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Driver&apos;s licence details
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            We check your licence is valid and doesn&apos;t expire before your
            rental ends. An expired date is rejected automatically.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="license-number">Licence number</Label>
                <Input
                  id="license-number"
                  placeholder="As printed on your licence"
                  value={licenseNumber}
                  onChange={(e) => {
                    setLicenseNumber(e.target.value);
                    submit.reset(); // clear stale saved/error feedback while editing
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="license-expiry">Expiry date</Label>
                <Input
                  id="license-expiry"
                  type="date"
                  min={businessTodayIso()}
                  value={licenseExpiry}
                  onChange={(e) => {
                    setLicenseExpiry(e.target.value);
                    submit.reset();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Must be today or later.
                </p>
              </div>
            </div>

            {/* The submit resolves 200 even when the server AUTO-REJECTS an
                expired licence — key the message off the returned status, never
                assume success from a 200. */}
            {submit.isError ? (
              <p className="text-sm text-destructive">
                {(submit.error as Error).message}
              </p>
            ) : submit.isSuccess ? (
              submit.data.status === "rejected" ? (
                <p className="text-sm text-destructive">
                  {submit.data.rejectionReason ??
                    "Your licence could not be accepted."}
                </p>
              ) : (
                <p className="text-sm text-success">Licence details saved.</p>
              )
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!ready || submit.isPending}>
                {submit.isPending
                  ? "Saving…"
                  : v.status === "unverified"
                    ? "Submit licence"
                    : "Update licence"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Then upload your photos below.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Document uploaders */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Identity photos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a clear photo or PDF of each. The driver&apos;s licence is
            required.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {REQUIRED_DOCS.map(({ type, label, hint }) => {
            const existing = docByType(type);
            const uploadingThis =
              upload.isPending && upload.variables?.type === type;
            const errorThis =
              upload.isError && upload.variables?.type === type;
            return (
              <div key={type} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`doc-${type}`}>{label}</Label>
                  {existing ? (
                    <Badge variant="success">Uploaded</Badge>
                  ) : (
                    <Badge variant="secondary">Needed</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{hint}</p>
                <input
                  id={`doc-${type}`}
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={uploadingThis}
                  onChange={(e) => onPick(type, e)}
                  className="block w-full cursor-pointer rounded-[var(--radius-sm)] border border-border bg-surface text-sm text-muted-foreground shadow-sm transition-colors hover:border-border-strong file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-border file:bg-muted file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-border disabled:cursor-not-allowed disabled:opacity-50"
                />
                {uploadingThis ? (
                  <p className="text-xs text-muted-foreground">Uploading…</p>
                ) : existing ? (
                  <p className="text-xs text-muted-foreground">
                    Current: {existing.filename}. Pick a new file to replace it.
                  </p>
                ) : null}
                {errorThis ? (
                  <p className="text-sm text-destructive">
                    {(upload.error as Error).message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Uploaded list */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Your documents</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <EmptyState
              title="No documents uploaded yet"
              description="Add your ID and driver's licence photos above."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {d.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_TYPE_LABELS[d.type] ?? d.type} ·{" "}
                      {formatUploaded(d.uploadedAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{d.contentType}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        We&apos;ll notify you once your identity has been reviewed. Once
        verified, you can request bookings right away.
      </p>
    </div>
  );
}
