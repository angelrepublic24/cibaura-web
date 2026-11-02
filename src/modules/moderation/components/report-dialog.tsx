"use client";

import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  useFileReport,
  useReportReasons,
} from "@/modules/moderation/hooks/moderation.hook";
import {
  reportReasonHint,
  reportReasonLabel,
  reportTargetNoun,
} from "@/modules/moderation/helpers/moderation.helper";
import { REPORT_DETAIL_MAX } from "@/modules/moderation/schema/moderation.schema";
import type { ReportTargetType } from "@/modules/moderation/types/moderation.types";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * The form. `reason` is a slug the SERVER offered (see `useReportReasons`),
 * so it is validated as "something was picked", not against a hardcoded
 * union — the list is allowed to change without a web deploy.
 */
const reportSchema = z.object({
  reason: z.string().min(1, "Pick a reason"),
  detail: z
    .string()
    .trim()
    .max(REPORT_DETAIL_MAX, `At most ${REPORT_DETAIL_MAX} characters`),
});
type ReportFormValues = z.infer<typeof reportSchema>;

/** Copy for the report-time backend codes (`moderation-codes.ts`). */
function describeModerationError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.REPORT_REASON_NOT_ALLOWED:
      return "That reason does not apply to this kind of report. Pick another one.";
    case API_ERROR_CODES.REPORT_TARGET_NOT_FOUND:
      return "This is no longer available, so it cannot be reported.";
    case API_ERROR_CODES.MODERATION_SELF_TARGET:
      return "This is your own content — there is nothing to report.";
    case API_ERROR_CODES.REPORT_EXISTS:
      return "You have already reported this, and it is already in our review queue.";
    default:
      return getErrorMessage(error, "Could not send the report.");
  }
}

/**
 * Report a listing, an agency, a person or a chat message to the platform
 * team.
 *
 * COPY RULE THIS SCREEN OBEYS: the reporter never hears back. They cannot
 * read the moderation queue (by design — `POST /reports` answers with an id
 * and a status and nothing else), and no notification is raised when an
 * admin resolves it. So the acknowledgement says what is TRUE — it reached
 * the team — and promises no reply, no timeline and no outcome.
 *
 * It is also NOT a refund path. The booking surfaces keep that separation
 * explicit next to `<ReportProblemNotice/>`, which is the mailto for a car
 * that was never handed over.
 */
export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetName,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** What is being reported, for the dialog subtitle. */
  targetName?: string;
}) {
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: "", detail: "" },
  });

  // Only while the dialog is open: the lists are a deployment-level fact and
  // every closed dialog on the page would otherwise fetch them.
  const reasonsQuery = useReportReasons(open);
  const reasons = reasonsQuery.data?.[targetType] ?? [];

  const mutation = useFileReport();

  const { reset } = form;
  const { reset: resetMutation } = mutation;
  useEffect(() => {
    if (open) {
      reset({ reason: "", detail: "" });
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  const busy = mutation.isPending;
  const errors = form.formState.errors;
  const detailId = useId();
  const reasonLegendId = useId();
  const sent = mutation.isSuccess;
  const noun = reportTargetNoun(targetType);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={sent ? "Report sent" : `Report this ${noun}`}
      description={
        sent
          ? undefined
          : targetName
            ? `Our team reviews reports about ${targetName}. Tell us what is wrong.`
            : "Our team reviews every report. Tell us what is wrong."
      }
    >
      {sent ? (
        /*
         * No follow-up is promised because none exists: there is no ticket to
         * track and no notification when it is resolved.
         */
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Thanks — this is with our moderation team now. We review reports
            privately and do not reply individually, so you will not get a
            message back about this one.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate({
              targetType,
              targetId,
              reason: values.reason,
              // Omitted, never sent blank: the reason alone is often the
              // whole story and the field is optional server-side.
              detail: values.detail.trim() || undefined,
            }),
          )}
        >
          {reasonsQuery.isLoading ? (
            <div className="space-y-2" aria-hidden>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-40" />
            </div>
          ) : reasonsQuery.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(
                  reasonsQuery.error,
                  "The list of reasons could not be loaded.",
                )}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void reasonsQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <fieldset className="space-y-2" aria-describedby={reasonLegendId}>
              <legend
                id={reasonLegendId}
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                What is wrong?
              </legend>
              {reasons.map((reason) => (
                <ReasonOption
                  key={reason}
                  reason={reason}
                  disabled={busy}
                  register={form.register}
                />
              ))}
              {errors.reason ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.reason.message}
                </p>
              ) : null}
            </fieldset>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={detailId}>Anything to add? (optional)</Label>
            <Textarea
              id={detailId}
              maxLength={REPORT_DETAIL_MAX}
              placeholder="What happened, and where we should look."
              disabled={busy}
              aria-invalid={!!errors.detail}
              {...form.register("detail")}
            />
            {errors.detail ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.detail.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only our moderation team reads this.
                {targetType === "message" || targetType === "user"
                  ? " The other person is not told you reported them."
                  : ""}
              </p>
            )}
          </div>

          {mutation.error ? (
            <p className="text-sm text-destructive" role="alert">
              {describeModerationError(mutation.error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Not now
            </Button>
            <Button type="submit" disabled={busy || reasonsQuery.isError}>
              {busy ? "Sending…" : "Send report"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/**
 * One native radio. Split out so each option can own a `useId()` — the hint
 * line needs an id to be associated with, and hooks cannot run in a loop
 * body.
 */
function ReasonOption({
  reason,
  disabled,
  register,
}: {
  reason: string;
  disabled: boolean;
  register: ReturnType<typeof useForm<ReportFormValues>>["register"];
}) {
  const id = useId();
  const hintId = useId();
  const hint = reportReasonHint(reason);
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input
          id={id}
          type="radio"
          className="mt-1"
          value={reason}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          {...register("reason")}
        />
        <span className="text-foreground">{reportReasonLabel(reason)}</span>
      </label>
      {hint ? (
        <p id={hintId} className="ml-6 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
