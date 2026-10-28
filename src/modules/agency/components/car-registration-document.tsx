"use client";

import { FileCheck } from "lucide-react";
import {
  useCarDocuments,
  useUploadCarDocument,
} from "@/modules/agency/hooks/agency.hook";
import {
  FILE_INPUT_CLASS,
} from "@/modules/agencies/components/agency-document-uploader";
import { getErrorMessage } from "@/shared/api/errors";
import {
  CAR_DOCUMENT_TYPE_REGISTRATION,
  type CarDocumentDto,
  type CarDocumentStatus,
} from "@/shared/types/domain";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";
const STATUS_META: Record<
  CarDocumentStatus,
  { label: string; variant: "warning" | "success" | "destructive" }
> = {
  pending: { label: "Pending review", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function isCarDocumentStatus(status: string): status is CarDocumentStatus {
  return status in STATUS_META;
}

/** Status chip for a car document; `null` document = nothing uploaded yet. */
export function CarDocumentStatusBadge({
  document,
}: {
  document: CarDocumentDto | null;
}) {
  if (!document) return <Badge variant="secondary">Not uploaded</Badge>;
  if (!isCarDocumentStatus(document.status)) {
    return <Badge variant="secondary">{document.status}</Badge>;
  }
  const meta = STATUS_META[document.status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Per-car vehicle registration ("matrícula") — ADR-0009. Individual hosts
 * need it VERIFIED by an admin before the car can be published (business
 * agencies may upload it too). Replace-by-type: a new upload supersedes the
 * previous file and goes back to `pending`. Reads/writes
 * `/agency/fleet/:carId/documents`.
 */
export function CarRegistrationDocumentCard({
  carId,
  canUpload,
  onUploaded,
  className,
}: {
  carId: string;
  /** `fleet:write` holders only — viewers see the status without the picker. */
  canUpload: boolean;
  onUploaded?: (document: CarDocumentDto) => void;
  className?: string;
}) {
  const query = useCarDocuments(carId);

  // The hook replaces the previous row of this type in the cache and
  // refreshes the fleet (whose rows carry `registration`); telling the
  // caller is ours.
  const uploadDocument = useUploadCarDocument(carId);
  const upload = {
    isPending: uploadDocument.isPending,
    error: uploadDocument.error,
    mutate: (file: File) =>
      uploadDocument.mutate(
        { file, type: CAR_DOCUMENT_TYPE_REGISTRATION },
        { onSuccess: (document) => onUploaded?.(document) },
      ),
  };

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    upload.mutate(file);
  }

  const registration =
    query.data?.find((d) => d.type === CAR_DOCUMENT_TYPE_REGISTRATION) ?? null;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-4 w-4 text-primary" />
            Registration document
          </CardTitle>
          {query.isSuccess ? (
            <CarDocumentStatusBadge document={registration} />
          ) : null}
        </div>
        <CardDescription>
          The vehicle registration card (matrícula) for this exact car — the
          plate must match. An admin verifies it before the car can be
          published.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? (
          <LoadingState label="Loading document…" className="py-4" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load the registration document"
            message={getErrorMessage(query.error, "Please try again.")}
            onRetry={() => query.refetch()}
            className="py-6"
          />
        ) : (
          <>
            {registration ? (
              <div
                className={cn(
                  "rounded-[var(--radius-sm)] border p-3 text-sm",
                  registration.status === "rejected"
                    ? "border-red-200 bg-red-50"
                    : "border-border bg-muted/40",
                )}
              >
                <p className="font-medium text-foreground">
                  {registration.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  Uploaded {fmtDate(registration.uploadedAt)}
                  {registration.reviewedAt
                    ? ` · reviewed ${fmtDate(registration.reviewedAt)}`
                    : " · awaiting review"}
                </p>
                {registration.status === "rejected" && registration.rejectionReason ? (
                  <p className="mt-2 text-sm text-red-700">
                    <span className="font-medium">Reason: </span>
                    {registration.rejectionReason}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No registration document yet.
              </p>
            )}

            {canUpload ? (
              <div className="space-y-1.5">
                <Label htmlFor={`car-reg-${carId}`}>
                  {registration
                    ? registration.status === "rejected"
                      ? "Upload a corrected file"
                      : "Replace the file"
                    : "Upload the registration card"}
                </Label>
                <input
                  id={`car-reg-${carId}`}
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={upload.isPending}
                  onChange={onPick}
                  className={FILE_INPUT_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  {upload.isPending
                    ? "Uploading…"
                    : "A clear photo or PDF. Replacing it sends the car back to review."}
                </p>
                {upload.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {getErrorMessage(upload.error, "The upload failed. Try again.")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
