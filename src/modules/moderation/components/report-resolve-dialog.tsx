"use client";

import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useResolveReport } from "@/modules/moderation/hooks/moderation.hook";
import {
  allowedReportTransitions,
  isClosingReportStatus,
  resolveStatusCopy,
} from "@/modules/moderation/helpers/moderation.helper";
import {
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  RESOLVE_REPORT_STATUSES,
} from "@/modules/moderation/schema/moderation.schema";
import type {
  AdminReport,
  ResolveReportStatus,
} from "@/modules/moderation/types/moderation.types";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

/**
 * Backend `ResolveReportDto`: note 2..1000, required on a CLOSING status.
 *
 * TWO SEPARATE RULES, and conflating them is how a one-character note used to
 * escape. Whether a note is REQUIRED depends on the status; its LENGTH BOUNDS
 * do not — `@MinLength(2)`/`@MaxLength` sit on the optional DTO field and
 * apply to any note that is actually sent, `reviewing` included. So "x" in the
 * note the form itself calls optional has to be caught here; otherwise it
 * leaves this form, fails the outbound `resolveReportInputSchema.parse` in the
 * service, and the admin is shown a raw zod issue list for pressing "Take it".
 */
const resolveSchema = z
  .object({
    status: z.enum(RESOLVE_REPORT_STATUSES),
    note: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const reject = (message: string) =>
      ctx.addIssue({ code: "custom", path: ["note"], message });

    // A blank note is "no note": fine for `reviewing`, and the one thing a
    // decision cannot do (400 REPORT_RESOLUTION_NOTE_REQUIRED otherwise).
    if (values.note.length === 0) {
      if (isClosingReportStatus(values.status)) {
        reject(
          `Say what you decided (at least ${RESOLUTION_NOTE_MIN} characters)`,
        );
      }
      return;
    }

    // A note that IS written travels, whatever the status — so it must clear
    // the DTO's bounds whatever the status.
    if (values.note.length < RESOLUTION_NOTE_MIN) {
      reject(
        isClosingReportStatus(values.status)
          ? `Say what you decided (at least ${RESOLUTION_NOTE_MIN} characters)`
          : `At least ${RESOLUTION_NOTE_MIN} characters, or leave it empty`,
      );
    } else if (values.note.length > RESOLUTION_NOTE_MAX) {
      reject(`At most ${RESOLUTION_NOTE_MAX} characters`);
    }
  });
type ResolveFormValues = z.infer<typeof resolveSchema>;

/** Copy for the resolve-time backend codes (`moderation-codes.ts`). */
function describeModerationError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.REPORT_NOT_OPEN:
      return "This report has already been decided — refresh to see who closed it and why.";
    case API_ERROR_CODES.REPORT_RESOLUTION_NOTE_REQUIRED:
      return "Closing a report needs a note saying what you decided.";
    default:
      return getErrorMessage(error, "Could not move this report.");
  }
}

/**
 * Admin decision on one report.
 *
 * Two different acts behind one form, and the copy keeps them apart:
 *  - `reviewing` — "I picked this up". No note, nothing is final, and
 *    `resolvedAt` stays null.
 *  - `actioned` / `dismissed` — a DECISION. A note is required and the
 *    report can never move again, so the form says so before submitting.
 *
 * `actioned` triggers nothing automatically: suspending an agency or pulling
 * a listing happens through the existing admin screens, and the note is the
 * audit record that it was done. The hint text says this rather than letting
 * an admin assume the button did it.
 *
 * THE REPORTER IS NEVER TOLD. There is no notification on resolve, by
 * design, so nothing here may promise one.
 */
export function ReportResolveDialog({
  open,
  onClose,
  report,
}: {
  open: boolean;
  onClose: () => void;
  report: AdminReport;
}) {
  const options = allowedReportTransitions(report.status);
  // The default is the first thing this report can become: "I am looking at
  // this" while it is open, otherwise straight to a decision.
  const defaultStatus: ResolveReportStatus = options[0] ?? "actioned";
  // A decided report has nowhere to go. Callers already hide the button that
  // opens this, so reaching here means a race — render nothing rather than a
  // form with no options whose only possible outcome is a 409.
  const nowhereToGo = options.length === 0;

  const form = useForm<ResolveFormValues>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { status: defaultStatus, note: "" },
  });

  // The hook stores the moved report and refreshes the queue; closing the
  // dialog is this caller's.
  const resolve = useResolveReport(report.id);
  const mutation = {
    isPending: resolve.isPending,
    error: resolve.error,
    reset: resolve.reset,
    mutate: (input: { status: ResolveReportStatus; note?: string }) =>
      resolve.mutate(input, { onSuccess: onClose }),
  };

  const { reset } = form;
  const { reset: resetMutation } = mutation;
  useEffect(() => {
    if (open) {
      reset({ status: defaultStatus, note: "" });
      resetMutation();
    }
  }, [open, reset, resetMutation, defaultStatus]);

  const status = form.watch("status");
  const closing = isClosingReportStatus(status);
  const busy = mutation.isPending;
  const errors = form.formState.errors;
  const noteId = useId();

  if (nowhereToGo) return null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Move this report"
      description={`${report.reporter.name} reported this ${report.targetTypeLabel}.`}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate({
            status: values.status,
            // Never send a blank note: `reviewing` takes none, and sending ""
            // would fail the DTO's MinLength instead of being ignored.
            note: values.note.trim() || undefined,
          }),
        )}
      >
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Decision
          </legend>
          {options.map((option) => (
            <StatusOption
              key={option}
              status={option}
              disabled={busy}
              register={form.register}
            />
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor={noteId}>
            {closing ? "Decision note" : "Note (optional)"}
          </Label>
          <Textarea
            id={noteId}
            maxLength={RESOLUTION_NOTE_MAX}
            placeholder={
              closing
                ? "What you found and what was done about it."
                : "Anything worth leaving for whoever picks this up next."
            }
            disabled={busy}
            aria-invalid={!!errors.note}
            {...form.register("note")}
          />
          {errors.note ? (
            <p className="text-sm text-destructive">{errors.note.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Internal only — the person who reported this never sees it and
              is not notified.
            </p>
          )}
        </div>

        {closing ? (
          <p
            className="rounded-[var(--radius-sm)] border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning"
            role="status"
          >
            This is final: a decided report cannot be reopened. If it happens
            again, the reporter can file a new one.
          </p>
        ) : null}

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
          <Button
            type="submit"
            variant={status === "actioned" ? "destructive" : "default"}
            disabled={busy}
          >
            {busy ? "Saving…" : closing ? "Close report" : "Take it"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** One native radio with its explanation, each owning its own `useId()`. */
function StatusOption({
  status,
  disabled,
  register,
}: {
  status: ResolveReportStatus;
  disabled: boolean;
  register: ReturnType<typeof useForm<ResolveFormValues>>["register"];
}) {
  const id = useId();
  const hintId = useId();
  const copy = resolveStatusCopy(status);
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input
          id={id}
          type="radio"
          className="mt-1"
          value={status}
          disabled={disabled}
          aria-describedby={hintId}
          {...register("status")}
        />
        <span className="text-foreground">{copy.label}</span>
      </label>
      <p id={hintId} className="ml-6 text-xs text-muted-foreground">
        {copy.hint}
      </p>
    </div>
  );
}
