"use client";

import { useState } from "react";

import { Car } from "lucide-react";
import {
  useDownloadCarDocument,
  useRejectCarDocument,
  useVerifyCarDocument,
} from "@/modules/admin/hooks/admin.hook";
import {
  useAgencyCars,
  useCarDocuments,
} from "@/modules/admin/hooks/admin.hook";
import {
  CarDocumentStatusBadge,
} from "@/modules/agency/components/car-registration-document";
import { getErrorMessage } from "@/shared/api/errors";
import type { AgencyCar, CarDocumentAdminDto } from "@/shared/types/domain";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { formatDateTime } from "@/shared/utils/dates";
const DOC_TYPE_LABELS: Record<string, string> = {
  registration: "Vehicle registration",
};

/**
 * Per-car registration documents of an applicant (ADR-0009). Individual
 * hosts need every car's registration VERIFIED before it can go live.
 * Cars come from the (assumed) admin fleet route; the documents and the
 * verify/reject actions are the spec's `/admin/cars/:carId/documents` routes.
 */
export function CarDocumentsReview({ agencyId }: { agencyId: string }) {
  const cars = useAgencyCars(agencyId);

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">
        Vehicle registration documents
      </h3>
      <div className="mt-3">
        {cars.isLoading ? (
          <LoadingState label="Loading the applicant's cars…" className="py-6" />
        ) : cars.isError ? (
          <ErrorState
            title="Could not load the cars"
            message={getErrorMessage(cars.error, "Please try again.")}
            onRetry={() => cars.refetch()}
            className="py-6"
          />
        ) : (cars.data ?? []).length === 0 ? (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            This applicant has not added any car yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {(cars.data ?? []).map((car) => (
              <CarDocumentsRow key={car.id} car={car} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CarDocumentsRow({ car }: { car: AgencyCar }) {
  const docs = useCarDocuments(car.id);
  return (
    <li className="rounded-[var(--radius-sm)] border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Car className="h-4 w-4 text-primary" />
          {car.make.name} {car.model.name} {car.year}
          {car.plate ? (
            <span className="font-mono text-xs text-muted-foreground">
              {car.plate}
            </span>
          ) : null}
        </p>
        <span className="text-xs capitalize text-muted-foreground">{car.status}</span>
      </div>
      {docs.isLoading ? (
        <LoadingState label="Loading documents…" className="py-4" />
      ) : docs.isError ? (
        <ErrorState
          title="Could not load documents"
          message={getErrorMessage(docs.error, "Please try again.")}
          onRetry={() => docs.refetch()}
          className="py-4"
        />
      ) : (docs.data ?? []).length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          No registration document uploaded for this car.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {(docs.data ?? []).map((doc) => (
            <CarDocumentItem key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
    </li>
  );
}

function CarDocumentItem({ doc }: { doc: CarDocumentAdminDto }) {
  const [rejectOpen, setRejectOpen] = useState(false);

  // A decision changes this car's documents, the application's
  // pending-document count and whether the car may be published — the hooks
  // refresh the whole admin subtree for that reason.
  const download = useDownloadCarDocument(doc.carId);
  const verifyDocument = useVerifyCarDocument(doc.carId);
  const rejectDocument = useRejectCarDocument(doc.carId);

  const view = {
    isPending: download.isPending,
    error: download.error,
    mutate: () =>
      download.mutate(doc.id, {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank", "noopener");
          // Revoke later so the opened tab has time to load the bytes.
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
      }),
  };

  const verify = {
    isPending: verifyDocument.isPending,
    error: verifyDocument.error,
    mutate: () => verifyDocument.mutate(doc.id),
  };

  const busy = verify.isPending;

  return (
    <li className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{doc.filename}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {DOC_TYPE_LABELS[doc.type] ?? doc.type} · uploaded{" "}
            {formatDateTime(doc.uploadedAt)}
            {doc.reviewedAt ? ` · reviewed ${formatDateTime(doc.reviewedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CarDocumentStatusBadge document={doc} />
          <Button
            variant="outline"
            size="sm"
            disabled={view.isPending}
            onClick={() => view.mutate()}
          >
            {view.isPending ? "Opening…" : "View"}
          </Button>
          {doc.status !== "verified" ? (
            <Button size="sm" disabled={busy} onClick={() => verify.mutate()}>
              {verify.isPending ? "Verifying…" : "Verify"}
            </Button>
          ) : null}
          {doc.status === "pending" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
            >
              Reject…
            </Button>
          ) : null}
        </div>
      </div>
      {doc.status === "rejected" && doc.rejectionReason ? (
        <p className="text-xs text-red-700">Rejected: {doc.rejectionReason}</p>
      ) : null}
      {view.error ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(view.error, "Could not open the document.")}
        </p>
      ) : null}
      {verify.error ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(verify.error, "Could not verify the document.")}
        </p>
      ) : null}

      <ReasonDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this registration document?"
        description="The host is notified and must upload a new file before the car can be published."
        field={{
          label: "Reason",
          placeholder: "e.g. The plate on the document does not match the car",
          hint: "Shown to the host.",
          minLength: 2,
          maxLength: 300,
        }}
        confirmLabel="Reject document"
        destructive
        onConfirm={async (value) => {
          await rejectDocument.mutateAsync({
            docId: doc.id,
            reason: value ?? "",
          });
        }}
      />
    </li>
  );
}
