"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AlertTriangle, IdCard, ImagePlus, Sun } from "lucide-react";
import {
  useMyVerification,
  useSubmitVerification,
  useUploadVerificationDocument,
} from "../hooks/verification.hook";
import {
  LICENSE_NUMBER_MAX,
  licenseSchema,
} from "../schema/verification.schema";
import { businessTodayIso, formatIsoDate } from "@/shared/utils/dates";
import { getErrorMessage } from "@/shared/api/errors";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type {
  CustomerDocument,
  CustomerVerification,
} from "@/shared/types/domain";
import { AdditionalDocumentsPanel } from "./additional-documents-panel";

const detailsSchema = licenseSchema.pick({
  licenseNumber: true,
  licenseExpiry: true,
});
const STATUS = {
  unverified: "Not submitted",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Correction needed",
};
export function StatusBanner({ v }: { v: CustomerVerification }) {
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {v.status === "verified"
            ? "Your driver's license has been verified."
            : "Your driver's license is reviewed by Cibaura verification."}
        </p>
        <Badge
          variant={
            v.status === "verified"
              ? "success"
              : v.status === "rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {STATUS[v.status]}
        </Badge>
      </div>
      {v.rejectionReason && v.status === "rejected" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {v.rejectionReason}
        </p>
      )}
      {(v.licenseExpired || v.licenseExpiresSoon) && (
        <div className="settings-note">
          <AlertTriangle aria-hidden="true" />
          <span>
            {v.licenseExpired
              ? "Your driver's license is expired."
              : "Your driver's license expires soon."}
            {v.licenseExpiry
              ? ` Expiration: ${formatIsoDate(v.licenseExpiry)}.`
              : ""}{" "}
            Your license must remain valid through the rental.
          </span>
        </div>
      )}
      {!v.dateOfBirth && (
        <p className="text-sm text-muted-foreground">
          Add your date of birth in{" "}
          <Link
            href="/account/settings/profile"
            className="font-medium text-primary underline"
          >
            Profile
          </Link>{" "}
          before submitting your license.
        </p>
      )}
    </div>
  );
}

function LicenseUpload({
  type,
  label,
  document,
}: {
  type: "license_front" | "license_back";
  label: string;
  document?: CustomerDocument;
}) {
  const upload = useUploadVerificationDocument();
  const [localError, setLocalError] = useState<string | null>(null);
  return (
    <div className="settings-upload">
      <div className="settings-upload-heading">
        <label htmlFor={`doc-${type}`} className="text-sm font-medium">
          {label}
        </label>
        <Badge variant={document ? "success" : "secondary"}>
          {document ? "Uploaded" : "Needed"}
        </Badge>
      </div>
      <div className="settings-drop">
        <ImagePlus aria-hidden="true" />
        <strong>{document ? "Photo uploaded" : label}</strong>
        <span className="text-xs">
          {document?.filename ?? "Choose a clear, uncropped image"}
        </span>
        <small>JPEG, PNG, WEBP or PDF · up to 10 MB</small>
        <input
          id={`doc-${type}`}
          aria-label={`Upload ${label.toLowerCase()}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={upload.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setLocalError(null);
            if (!file) return;
            if (
              ![
                "image/jpeg",
                "image/png",
                "image/webp",
                "application/pdf",
              ].includes(file.type) ||
              file.size > 10 * 1024 * 1024
            ) {
              setLocalError("Choose a JPEG, PNG, WEBP or PDF up to 10 MB.");
              return;
            }
            upload.mutate({ file, type });
          }}
        />
      </div>
      {upload.isPending && (
        <p className="text-xs" role="status">
          Uploading…
        </p>
      )}
      {document && (
        <p className="text-xs text-muted-foreground">
          Choose a new file to replace the current photo.
        </p>
      )}
      {(localError || upload.isError) && (
        <p className="text-sm text-destructive" role="alert">
          {localError ??
            getErrorMessage(upload.error, "Upload failed. Please try again.")}
        </p>
      )}
    </div>
  );
}

function LicenseDetailsCard({
  verification,
  documents,
}: {
  verification: CustomerVerification;
  documents: CustomerDocument[];
}) {
  const form = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      licenseNumber: verification.licenseNumber ?? "",
      licenseExpiry: verification.licenseExpiry ?? "",
    },
  });
  const submit = useSubmitVerification();
  return (
    <section className="settings-surface">
      <div className="settings-surface-head">
        <h3 className="flex items-center gap-2">
          <IdCard aria-hidden="true" className="h-5 w-5" />
          Driver&apos;s license
        </h3>
        <p>Use your current, valid driver&apos;s license.</p>
      </div>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (verification.dateOfBirth)
            submit.mutate({ ...values, dateOfBirth: verification.dateOfBirth });
        })}
        onChange={() => {
          if (submit.isError || submit.isSuccess) submit.reset();
        }}
      >
        <div className="settings-surface-body">
          <div className="settings-fields">
            <label className="settings-field" htmlFor="license-number">
              License number
              <input
                id="license-number"
                autoComplete="off"
                maxLength={LICENSE_NUMBER_MAX}
                aria-invalid={!!form.formState.errors.licenseNumber}
                {...form.register("licenseNumber")}
              />
              <small>As printed on your license.</small>
              {form.formState.errors.licenseNumber && (
                <span className="text-destructive">
                  {form.formState.errors.licenseNumber.message}
                </span>
              )}
            </label>
            <label className="settings-field" htmlFor="license-expiry">
              Expiration date
              <input
                id="license-expiry"
                type="date"
                min={businessTodayIso()}
                aria-invalid={!!form.formState.errors.licenseExpiry}
                {...form.register("licenseExpiry")}
              />
              <small>Your license must remain valid through the rental.</small>
              {form.formState.errors.licenseExpiry && (
                <span className="text-destructive">
                  {form.formState.errors.licenseExpiry.message}
                </span>
              )}
            </label>
          </div>
          <div className="mt-6 border-t border-border pt-6">
            <h4 className="mb-1 font-medium">License photos</h4>
            <p className="mb-4 text-xs text-muted-foreground">
              Upload both sides. Keep all four corners visible.
            </p>
            <div className="settings-upload-grid">
              <LicenseUpload
                type="license_front"
                label="Front of license"
                document={documents.find((doc) => doc.type === "license_front")}
              />
              <LicenseUpload
                type="license_back"
                label="Back of license"
                document={documents.find((doc) => doc.type === "license_back")}
              />
            </div>
            <p className="settings-note">
              <Sun aria-hidden="true" />
              Use good lighting, avoid glare and make sure the text is readable.
            </p>
          </div>
          {submit.isError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {getErrorMessage(submit.error, "Could not submit your license.")}
            </p>
          )}
          {submit.isSuccess && (
            <p
              role={submit.data.status === "rejected" ? "alert" : "status"}
              className={`mt-4 text-sm ${submit.data.status === "rejected" ? "text-destructive" : "text-success"}`}
            >
              {submit.data.status === "rejected"
                ? (submit.data.rejectionReason ??
                  "Your license could not be accepted.")
                : "License details saved for review."}
            </p>
          )}
        </div>
        <div className="settings-action-bar">
          <p>We&apos;ll notify you when your license has been reviewed.</p>
          <Button
            type="submit"
            disabled={submit.isPending || !verification.dateOfBirth}
          >
            {submit.isPending ? "Submitting…" : "Submit license details"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function VerificationPanel() {
  const query = useMyVerification();
  if (query.isError)
    return (
      <ErrorState
        title="Could not load your verification"
        message={getErrorMessage(query.error, "Please try again.")}
        onRetry={() => query.refetch()}
      />
    );
  if (!query.data) return <LoadingState label="Loading your verification…" />;
  const { verification, documents } = query.data;
  const legacy = documents.filter(
    (doc) => doc.type === "id_front" || doc.type === "id_back",
  );
  return (
    <div>
      <StatusBanner v={verification} />
      <LicenseDetailsCard
        key={`${verification.licenseNumber}:${verification.licenseExpiry}`}
        verification={verification}
        documents={documents}
      />
      <AdditionalDocumentsPanel />
      {legacy.length > 0 && (
        <details className="mt-6 rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Previously supplied identity documents
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            These existing files remain on your record. Any new
            additional-document request appears separately above.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {legacy.map((doc) => (
              <li key={doc.id}>
                {doc.filename} ·{" "}
                {doc.type === "id_front" ? "ID front" : "ID back"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
