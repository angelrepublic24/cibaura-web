"use client";

import { useState } from "react";
import { FileCheck2, Files, ImagePlus } from "lucide-react";
import {
  useAdditionalAction,
  useAdditionalRequests,
} from "../hooks/additional-verification.hook";
import { additionalVerificationService } from "../services/additional-verification.service";
import {
  ADDITIONAL_DOCUMENT_LABELS,
  ADDITIONAL_SLOT_LABELS,
  ADDITIONAL_STATUS_LABELS,
  canSubmitAdditional,
  requiredAdditionalSlots,
} from "../helpers/additional-verification.helper";
import type {
  AdditionalFile,
  AdditionalRequest,
} from "../schema/additional-verification.schema";
import { useOpenSignedUrl } from "@/shared/hooks/use-open-signed-url";
import { getErrorMessage } from "@/shared/api/errors";
import { formatDateTime, formatIsoDate } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ErrorState, LoadingState } from "@/shared/components/states";

export function AdditionalFileLink({
  requestId,
  file,
}: {
  requestId: string;
  file: AdditionalFile;
}) {
  const view = useOpenSignedUrl(() =>
    additionalVerificationService.download(requestId, file.id),
  );
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={view.isPending}
        onClick={view.open}
      >
        {view.isPending ? "Opening…" : "View file"}
      </Button>
      {view.fallback && (
        <a
          className="ml-2 text-xs text-primary underline"
          href={view.fallback.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open file
        </a>
      )}
      {view.isError && (
        <p role="alert" className="text-xs text-destructive">
          {getErrorMessage(view.error, "Could not open this file.")}
        </p>
      )}
    </div>
  );
}

export function AdditionalRequestHistory({
  request,
  admin = false,
}: {
  request: AdditionalRequest;
  admin?: boolean;
}) {
  return (
    <details className="mt-5 border-t border-border pt-4">
      <summary className="cursor-pointer text-xs font-medium">
        Request history
      </summary>
      <ol className="mt-3 space-y-3 text-xs">
        {request.history.map((event) => (
          <li key={event.id}>
            <p className="font-medium">
              {event.action.replaceAll("_", " ")} · revision {event.revision}
            </p>
            <p className="text-muted-foreground">
              {event.actor === "admin"
                ? "Cibaura verification"
                : admin
                  ? "Customer"
                  : "You"}{" "}
              · {formatDateTime(event.createdAt)}
            </p>
            {event.note && <p className="mt-1">{event.note}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}

function CustomerAdditionalRequest({
  request,
}: {
  request: AdditionalRequest;
}) {
  const action = useAdditionalAction();
  const [fileError, setFileError] = useState<string | null>(null);
  const editing = ["requested", "correction_requested"].includes(
    request.status,
  );
  const current = request.files.filter(
    (file) => file.revision === request.revision,
  );
  const older = request.files.filter(
    (file) => file.revision !== request.revision,
  );
  return (
    <section className="settings-surface">
      <div className="settings-surface-head">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="settings-eyebrow">
              Additional document request
            </span>
            <h3>{ADDITIONAL_DOCUMENT_LABELS[request.documentType]}</h3>
            <p>Requested by Cibaura verification</p>
          </div>
          <Badge
            variant={request.status === "approved" ? "success" : "secondary"}
          >
            {ADDITIONAL_STATUS_LABELS[request.status]}
          </Badge>
        </div>
      </div>
      <div className="settings-surface-body">
        <div className="rounded-lg bg-accent-soft p-4">
          <h4 className="text-sm font-medium">Why we need this</h4>
          <p className="mt-1 text-sm">{request.reason}</p>
          {request.requestedBy && (
            <p className="mt-2 text-xs text-muted-foreground">
              Requested by {formatIsoDate(request.requestedBy)}
            </p>
          )}
        </div>
        {request.reviewNote && (
          <p role="status" className="mt-4 text-sm">
            {request.reviewNote}
          </p>
        )}
        {editing ? (
          <>
            <p className="my-4 text-xs text-muted-foreground">
              {request.status === "correction_requested"
                ? "Upload a complete replacement for this revision. Your previous submission remains in the history."
                : "Files upload privately as a draft. Cibaura can review them only after you submit this request."}
            </p>
            <div className="settings-upload-grid">
              {requiredAdditionalSlots(request).map((slot) => {
                const file = current.find((item) => item.slot === slot);
                return (
                  <div className="settings-upload" key={slot}>
                    <div className="settings-upload-heading">
                      <label htmlFor={`extra-${request.id}-${slot}`}>
                        {ADDITIONAL_SLOT_LABELS[slot]}
                      </label>
                      <Badge variant={file ? "success" : "secondary"}>
                        {file ? "Draft uploaded" : "Needed"}
                      </Badge>
                    </div>
                    <div className="settings-drop">
                      {file ? (
                        <FileCheck2 aria-hidden="true" />
                      ) : (
                        <ImagePlus aria-hidden="true" />
                      )}
                      <strong>{file?.filename ?? "Choose a file"}</strong>
                      <small>JPEG, PNG, WEBP or PDF · up to 10 MB</small>
                      <input
                        id={`extra-${request.id}-${slot}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={action.isPending}
                        onChange={(event) => {
                          const chosen = event.target.files?.[0];
                          event.target.value = "";
                          setFileError(null);
                          if (!chosen) return;
                          if (
                            ![
                              "image/jpeg",
                              "image/png",
                              "image/webp",
                              "application/pdf",
                            ].includes(chosen.type) ||
                            chosen.size > 10 * 1024 * 1024
                          ) {
                            setFileError(
                              "Choose a JPEG, PNG, WEBP or PDF up to 10 MB.",
                            );
                            return;
                          }
                          action.mutate({
                            action: "upload",
                            id: request.id,
                            revision: request.revision,
                            slot,
                            file: chosen,
                          });
                        }}
                      />
                    </div>
                    {file && (
                      <AdditionalFileLink requestId={request.id} file={file} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-5 space-y-3">
            {current.map((file) => (
              <div key={file.id} className="settings-reference-row">
                <div>
                  <h4>{ADDITIONAL_SLOT_LABELS[file.slot]}</h4>
                  <p>{file.filename}</p>
                </div>
                <AdditionalFileLink requestId={request.id} file={file} />
              </div>
            ))}
            {request.status === "submitted" && (
              <p className="text-sm text-muted-foreground">
                Submitted for review. We&apos;ll notify you when there is an
                update.
              </p>
            )}
          </div>
        )}
        {older.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-medium">
              Previous submitted files
            </summary>
            <ul className="mt-3 space-y-3">
              {older.map((file) => (
                <li
                  key={file.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <span className="break-all">
                    Revision {file.revision} · {file.filename}
                  </span>
                  <AdditionalFileLink requestId={request.id} file={file} />
                </li>
              ))}
            </ul>
          </details>
        )}
        {(fileError || action.isError) && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {fileError ??
              getErrorMessage(
                action.error,
                "Could not update this request. Review its current status and try again.",
              )}
          </p>
        )}
        <AdditionalRequestHistory request={request} />
      </div>
      {editing && (
        <div className="settings-action-bar">
          <p>
            Upload all requested files, then explicitly submit them for review.
          </p>
          <Button
            type="button"
            disabled={action.isPending || !canSubmitAdditional(request)}
            onClick={() =>
              action.mutate({
                action: "submit",
                id: request.id,
                revision: request.revision,
              })
            }
          >
            {action.isPending ? "Saving…" : "Submit additional documents"}
          </Button>
        </div>
      )}
    </section>
  );
}

export function AdditionalDocumentsPanel() {
  const query = useAdditionalRequests();
  if (query.isError)
    return (
      <ErrorState
        title="Could not load additional document requests"
        message={getErrorMessage(query.error, "Please try again.")}
        onRetry={() => query.refetch()}
      />
    );
  if (!query.data) return <LoadingState label="Loading additional requests…" />;
  if (query.data.length === 0)
    return (
      <section className="mt-7 flex items-start gap-3 border-t border-border pt-6">
        <Files
          className="h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <h3 className="text-sm font-medium">Additional documents</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            No additional documents have been requested.
          </p>
        </div>
      </section>
    );
  return (
    <div className="mt-7">
      {query.data.map((request) => (
        <CustomerAdditionalRequest key={request.id} request={request} />
      ))}
    </div>
  );
}
