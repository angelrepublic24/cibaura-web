"use client";

import { useState } from "react";
import {
  useAdditionalAction,
  useAdditionalRequests,
} from "../hooks/additional-verification.hook";
import {
  ADDITIONAL_DOCUMENT_LABELS,
  ADDITIONAL_SLOT_LABELS,
  ADDITIONAL_STATUS_LABELS,
  canReviewAdditional,
} from "../helpers/additional-verification.helper";
import {
  additionalDocumentTypeSchema,
  createAdditionalRequestSchema,
  type AdditionalRequest,
} from "../schema/additional-verification.schema";
import {
  AdditionalFileLink,
  AdditionalRequestHistory,
} from "./additional-documents-panel";
import { getErrorMessage } from "@/shared/api/errors";
import { businessTodayIso, formatIsoDate } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { ErrorState, LoadingState } from "@/shared/components/states";

function ReviewAdditional({ request }: { request: AdditionalRequest }) {
  const [note, setNote] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const action = useAdditionalAction();
  const submitted = request.files.filter(
    (file) =>
      request.submittedRevision !== null &&
      file.revision <= request.submittedRevision,
  );
  const reviewable = canReviewAdditional(request);
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h4 className="font-medium">
          {ADDITIONAL_DOCUMENT_LABELS[request.documentType]}
        </h4>
        <Badge
          variant={request.status === "approved" ? "success" : "secondary"}
        >
          {ADDITIONAL_STATUS_LABELS[request.status]}
        </Badge>
      </div>
      <p className="mt-3 text-sm">{request.reason}</p>
      {request.requestedBy && (
        <p className="mt-2 text-xs text-muted-foreground">
          Requested by {formatIsoDate(request.requestedBy)}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        License verification is independent of this additional request. Customer
        drafts are private until submission.
      </p>
      <ul className="mt-4 space-y-3">
        {submitted.map((file) => (
          <li
            key={file.id}
            className="flex min-w-0 flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="break-all text-sm">{file.filename}</p>
              <p className="text-xs text-muted-foreground">
                {ADDITIONAL_SLOT_LABELS[file.slot]} · revision {file.revision}
              </p>
            </div>
            <AdditionalFileLink requestId={request.id} file={file} />
          </li>
        ))}
      </ul>
      {submitted.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No files have been submitted for review.
        </p>
      )}
      {request.reviewNote && (
        <p className="mt-4 text-sm">Previous review: {request.reviewNote}</p>
      )}
      {reviewable && (
        <div className="mt-5 space-y-3">
          <label className="block text-sm">
            Review note
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              placeholder="Explain any correction needed"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  action: "review",
                  id: request.id,
                  body: {
                    revision: request.revision,
                    decision: "approve",
                    ...(note.trim() ? { note: note.trim() } : {}),
                  },
                })
              }
            >
              Approve additional documents
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={action.isPending || !note.trim()}
              onClick={() =>
                action.mutate({
                  action: "review",
                  id: request.id,
                  body: {
                    revision: request.revision,
                    decision: "correction",
                    note: note.trim(),
                  },
                })
              }
            >
              Request correction
            </Button>
          </div>
        </div>
      )}
      {!["approved", "withdrawn"].includes(request.status) && (
        <details className="mt-5">
          <summary className="cursor-pointer text-xs">
            Withdraw this request
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              Reason
              <Textarea
                value={withdrawReason}
                onChange={(event) => setWithdrawReason(event.target.value)}
                maxLength={2000}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={action.isPending || !withdrawReason.trim()}
              onClick={() =>
                action.mutate({
                  action: "withdraw",
                  id: request.id,
                  revision: request.revision,
                  reason: withdrawReason.trim(),
                })
              }
            >
              Withdraw request
            </Button>
          </div>
        </details>
      )}
      {action.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {getErrorMessage(
            action.error,
            "Could not update this request. Review its refreshed status.",
          )}
        </p>
      )}
      <AdditionalRequestHistory request={request} admin />
    </section>
  );
}

export function AdditionalDocumentsAdmin({
  customerId,
}: {
  customerId: string;
}) {
  const query = useAdditionalRequests(customerId);
  const action = useAdditionalAction();
  const [type, setType] = useState("identity_card");
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div>
        <h3 className="text-base font-semibold">
          Additional document requests
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Request and review extra evidence separately from the driver&apos;s
          license.
        </p>
      </div>
      <form
        className="space-y-3 rounded-lg border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setValidation(null);
          const body = createAdditionalRequestSchema.safeParse({
            documentType: type,
            reason,
            ...(deadline ? { requestedBy: deadline } : {}),
          });
          if (!body.success) {
            setValidation(
              body.error.issues[0]?.message ?? "Review the request details.",
            );
            return;
          }
          action.mutate(
            { action: "create", customerId, body: body.data },
            {
              onSuccess: () => {
                setReason("");
                setDeadline("");
              },
            },
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Document type
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface p-2"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {additionalDocumentTypeSchema.options.map((option) => (
                <option key={option} value={option}>
                  {ADDITIONAL_DOCUMENT_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Requested by (optional)
            <Input
              type="date"
              min={businessTodayIso()}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          Why this is needed
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={2000}
          />
        </label>
        {(validation || action.isError) && (
          <p role="alert" className="text-sm text-destructive">
            {validation ??
              getErrorMessage(action.error, "Could not create this request.")}
          </p>
        )}
        <Button type="submit" disabled={action.isPending}>
          {action.isPending ? "Creating…" : "Send additional document request"}
        </Button>
      </form>
      {query.isError ? (
        <ErrorState
          title="Could not load additional requests"
          message={getErrorMessage(query.error, "Please try again.")}
          onRetry={() => query.refetch()}
        />
      ) : !query.data ? (
        <LoadingState label="Loading additional requests…" />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No additional requests for this customer.
        </p>
      ) : (
        query.data.map((request) => (
          <ReviewAdditional key={request.id} request={request} />
        ))
      )}
    </section>
  );
}
