"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { getErrorMessage } from "@/shared/api/errors";
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
 * to book. "No license, no service": a customer must submit a valid driver's
 * license + date of birth and upload their ID + license photos, then an admin
 * verifies them.
 *
 * The server is the authority — it auto-rejects an already-expired license on
 * submit, and the booking flow re-checks the gate (including each agency's
 * minimum driver age against the date of birth). This component shapes input
 * and surfaces the exact server message + the license expiry alerts (expired /
 * expires-soon) so the customer can act before a booking is ever blocked.
 */

/** Backend rule: the date of birth must be at least this many years ago. */
const MIN_AGE_YEARS = 16;

/** Backend `SubmitVerificationDto`: licenseNumber 3..60. */
const LICENSE_NUMBER_MIN = 3;
const LICENSE_NUMBER_MAX = 60;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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
    label: "Driver's license — front",
    hint: "Required. You cannot rent without a valid driver's license.",
  },
  {
    type: "license_back",
    label: "Driver's license — back",
    hint: "Back side of your driver's license.",
  },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  id_front: "ID — front",
  id_back: "ID — back",
  license_front: "License — front",
  license_back: "License — back",
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

/** Latest acceptable date of birth (today minus MIN_AGE_YEARS, business tz). */
function maxDateOfBirthIso(): string {
  const today = businessTodayIso();
  const year = Number(today.slice(0, 4)) - MIN_AGE_YEARS;
  return `${year}${today.slice(4)}`;
}

/**
 * Date-of-birth presence, read DEFENSIVELY: "on file" only when the wire
 * carries a real string; "missing" for `null` AND for an absent field (a
 * backend that does not emit it yet). An absent field must never lock the
 * input or block the submit — the server still validates the value.
 */
function hasDateOfBirth(v: CustomerVerification): boolean {
  return typeof v.dateOfBirth === "string";
}

function isDateOfBirthMissing(v: CustomerVerification): boolean {
  return v.dateOfBirth == null;
}

/** Shared field rule: ISO date, at least MIN_AGE_YEARS ago (evaluated at parse time). */
const dateOfBirthField = z
  .string()
  .regex(DATE_ONLY, "Enter your date of birth")
  .refine((v) => v <= maxDateOfBirthIso(), {
    message: `You must be at least ${MIN_AGE_YEARS} years old`,
  });

function StatusBadge({ status }: { status: CustomerVerificationStatus }) {
  if (status === "verified") return <Badge variant="success">Verified</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive">Rejected</Badge>;
  if (status === "pending")
    return <Badge variant="warning">Pending review</Badge>;
  return <Badge variant="secondary">Not started</Badge>;
}

/** The status banner + license-expiry alerts at the top of the page. */
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
                      ? "Fix the issue below, then re-submit your license and photos."
                      : v.status === "pending"
                        ? "We'll review your documents shortly. You can update them any time — your progress is saved."
                        : "Submit your driver's license details and upload your ID + license photos. A verified identity is required to book any car."}
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

      {/* License expiry alerts (independent of status) */}
      {v.licenseExpired ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">Your driver&apos;s license is expired</span>
            {v.licenseExpiry ? ` (expired ${formatIsoDate(v.licenseExpiry)})` : ""}.
            You cannot rent until you submit a valid license.
          </span>
        </div>
      ) : v.licenseExpiresSoon ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">Your license expires soon</span>
            {v.licenseExpiry ? ` (on ${formatIsoDate(v.licenseExpiry)}` : ""}
            {v.daysUntilExpiry != null
              ? `, in ${v.daysUntilExpiry} day${v.daysUntilExpiry === 1 ? "" : "s"})`
              : v.licenseExpiry
                ? ")"
                : ""}
            . Renew it soon — a rental that ends after your license expires
            can&apos;t be booked.
          </span>
        </div>
      ) : null}

      {/* Missing date of birth on an existing record (age gate needs it). */}
      {v.status !== "unverified" && isDateOfBirthMissing(v) ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">Add your date of birth.</span>{" "}
            Agencies set a minimum driver age; without your date of birth a
            booking request is refused. Add it below — your verification
            status does not change.
          </span>
        </div>
      ) : null}
    </div>
  );
}

const dateOfBirthSchema = z.object({ dateOfBirth: dateOfBirthField });
type DateOfBirthFormValues = z.infer<typeof dateOfBirthSchema>;

/**
 * One-field form for customers whose record predates the age gate: PATCHes
 * `/verification/me { dateOfBirth }` without touching the status. The
 * backend allows it only while the stored value is null.
 */
function DateOfBirthCard({ onSaved }: { onSaved: () => void }) {
  const form = useForm<DateOfBirthFormValues>({
    resolver: zodResolver(dateOfBirthSchema),
    defaultValues: { dateOfBirth: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: DateOfBirthFormValues) =>
      VerificationApi.setDateOfBirth(values.dateOfBirth),
    onSuccess: onSaved,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Date of birth</CardTitle>
        <p className="text-sm text-muted-foreground">
          Needed once to check each agency&apos;s minimum driver age. It is
          not shown to agencies.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="dob-patch">Date of birth</Label>
            <Input
              id="dob-patch"
              type="date"
              max={maxDateOfBirthIso()}
              autoComplete="bday"
              aria-invalid={!!form.formState.errors.dateOfBirth}
              {...form.register("dateOfBirth")}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save date of birth"}
          </Button>
          {form.formState.errors.dateOfBirth ? (
            <p className="basis-full text-sm text-destructive">
              {form.formState.errors.dateOfBirth.message}
            </p>
          ) : null}
          {mutation.isError ? (
            <p className="basis-full text-sm text-destructive" role="alert">
              {getErrorMessage(
                mutation.error,
                "Could not save your date of birth. Please try again.",
              )}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

const licenseSchema = z.object({
  licenseNumber: z
    .string()
    .trim()
    .min(LICENSE_NUMBER_MIN, "Enter your license number")
    .max(LICENSE_NUMBER_MAX, `At most ${LICENSE_NUMBER_MAX} characters`),
  // Expiry must be today or later in the BUSINESS timezone (matches the
  // server's gate). The server has the final word (and auto-rejects a past
  // date), but we block the obvious case on the same calendar day it uses.
  licenseExpiry: z
    .string()
    .regex(DATE_ONLY, "Enter the expiry date")
    .refine((v) => v >= businessTodayIso(), {
      message: "Your license is expired — the expiry date must be today or later",
    }),
  dateOfBirth: dateOfBirthField,
});
type LicenseFormValues = z.infer<typeof licenseSchema>;

function licenseDefaults(v: CustomerVerification): LicenseFormValues {
  return {
    licenseNumber: v.licenseNumber ?? "",
    licenseExpiry: v.licenseExpiry ?? "",
    dateOfBirth: v.dateOfBirth ?? "",
  };
}

/**
 * The license-details form (`POST /verification`). Mounted only once the
 * record has loaded, so the defaults come straight from it — no prefill
 * effect. The date of birth is locked ONLY when the wire says it is on
 * file (see `hasDateOfBirth`); its stored value still travels with the
 * submit, which the DTO requires.
 */
function LicenseDetailsCard({ verification: v }: { verification: CustomerVerification }) {
  const qc = useQueryClient();
  const dobOnFile = hasDateOfBirth(v);

  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseSchema),
    defaultValues: licenseDefaults(v),
  });
  const errors = form.formState.errors;

  const submit = useMutation({
    mutationFn: (input: SubmitVerificationInput) => VerificationApi.submit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: verificationKeys.me() });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">
          Driver&apos;s license details
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          We check your license is valid and doesn&apos;t expire before your
          rental ends. An expired date is rejected automatically.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((values) => submit.mutate(values))}
          onChange={() => {
            // Any edit clears the stale saved/error feedback.
            if (submit.isSuccess || submit.isError) submit.reset();
          }}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="license-number">License number</Label>
              <Input
                id="license-number"
                placeholder="As printed on your license"
                maxLength={LICENSE_NUMBER_MAX}
                autoComplete="off"
                aria-invalid={!!errors.licenseNumber}
                {...form.register("licenseNumber")}
              />
              {errors.licenseNumber ? (
                <p className="text-sm text-destructive">
                  {errors.licenseNumber.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="license-expiry">Expiry date</Label>
              <Input
                id="license-expiry"
                type="date"
                min={businessTodayIso()}
                aria-invalid={!!errors.licenseExpiry}
                {...form.register("licenseExpiry")}
              />
              {errors.licenseExpiry ? (
                <p className="text-sm text-destructive">
                  {errors.licenseExpiry.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Must be today or later.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date-of-birth">Date of birth</Label>
              <Input
                id="date-of-birth"
                type="date"
                max={maxDateOfBirthIso()}
                autoComplete="bday"
                disabled={dobOnFile}
                aria-invalid={!!errors.dateOfBirth}
                {...form.register("dateOfBirth")}
              />
              {errors.dateOfBirth ? (
                <p className="text-sm text-destructive">
                  {errors.dateOfBirth.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {dobOnFile
                    ? "On file. Contact support to correct it."
                    : "Agencies set a minimum driver age; we check it against this date."}
                </p>
              )}
            </div>
          </div>

          {/* The submit resolves 200 even when the server AUTO-REJECTS an
              expired license — key the message off the returned status, never
              assume success from a 200. */}
          {submit.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                submit.error,
                "Could not save your license details. Please try again.",
              )}
            </p>
          ) : submit.isSuccess ? (
            submit.data.status === "rejected" ? (
              <p className="text-sm text-destructive" role="alert">
                {submit.data.rejectionReason ??
                  "Your license could not be accepted."}
              </p>
            ) : (
              <p className="text-sm text-success" role="status">
                License details saved.
              </p>
            )
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending
                ? "Saving…"
                : v.status === "unverified"
                  ? "Submit license"
                  : "Update license"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Then upload your photos below.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function VerificationPanel() {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: verificationKeys.me(),
    queryFn: VerificationApi.me,
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
        message={getErrorMessage(meQuery.error, "Please try again.")}
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

      {v.status !== "unverified" && isDateOfBirthMissing(v) ? (
        <DateOfBirthCard
          onSaved={() => qc.invalidateQueries({ queryKey: verificationKeys.me() })}
        />
      ) : null}

      <LicenseDetailsCard verification={v} />

      {/* Document uploaders */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Identity photos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a clear photo or PDF of each. The driver&apos;s license is
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
                  <p className="text-sm text-destructive" role="alert">
                    {getErrorMessage(
                      upload.error,
                      "Upload failed. Please try again.",
                    )}
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
              description="Add your ID and driver's license photos above."
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
