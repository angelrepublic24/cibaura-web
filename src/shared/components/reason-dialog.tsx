"use client";

import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { getErrorMessage } from "@/shared/api/errors";

/**
 * Default bounds: the booking reject/cancel DTOs (`reason` 2..160). Screens
 * whose DTO differs (admin payout rejection: 300, a bank reference: 120…)
 * pass their own.
 */
export const DEFAULT_REASON_MIN_LENGTH = 2;
export const DEFAULT_REASON_MAX_LENGTH = 160;

/** The one text field a confirmation may ask for (a reason, a reference…). */
export interface ReasonFieldSpec {
  label: string;
  placeholder?: string;
  /** Rendered under the field (e.g. "Shown to the customer."). */
  hint?: string;
  /** Inclusive bounds mirrored from the backend DTO (default 2..160). */
  minLength?: number;
  maxLength?: number;
  /** Single-line input (a bank reference) instead of a textarea. */
  singleLine?: boolean;
  /** Empty allowed — sent as `undefined`. */
  optional?: boolean;
}

interface ReasonFormValues {
  value: string;
}

/**
 * Confirmation modal that collects ONE text value and runs an async action.
 * Owns its form (react-hook-form + zod), the pending state and the error
 * line; the caller passes `onConfirm` (usually an API call + invalidation)
 * and, optionally, `mapError` to turn known backend codes into copy. Closes
 * itself on success. Used for every "are you sure + why" flow: cancelling a
 * booking, paying/rejecting a payout, suspending an account.
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  field,
  confirmLabel,
  destructive = false,
  onConfirm,
  mapError,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  field: ReasonFieldSpec;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (value: string | undefined) => Promise<unknown>;
  /** Return copy for a known error, or `undefined` to fall back to the message. */
  mapError?: (error: unknown) => string | undefined;
}) {
  const inputId = useId();
  const minLength = field.minLength ?? DEFAULT_REASON_MIN_LENGTH;
  const maxLength = field.maxLength ?? DEFAULT_REASON_MAX_LENGTH;

  const schema = z.object({
    value: field.optional
      ? z
          .string()
          .trim()
          .max(maxLength, `At most ${maxLength} characters`)
          .refine(
            (v) => v.length === 0 || v.length >= minLength,
            `At least ${minLength} characters`,
          )
      : z
          .string()
          .trim()
          .min(minLength, `At least ${minLength} characters`)
          .max(maxLength, `At most ${maxLength} characters`),
  });

  const form = useForm<ReasonFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { value: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ReasonFormValues) =>
      onConfirm(values.value.length > 0 ? values.value : undefined),
    onSuccess: () => onClose(),
  });

  // A fresh form + a clean error line every time the dialog opens.
  const { reset } = form;
  const { reset: resetMutation } = mutation;
  useEffect(() => {
    if (open) {
      reset({ value: "" });
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  const busy = mutation.isPending;
  const fieldError = form.formState.errors.value?.message;
  const errorText = mutation.isError
    ? (mapError?.(mutation.error) ??
      getErrorMessage(mutation.error, "Something went wrong. Please try again."))
    : null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      description={description}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>
            {field.label}
            {field.optional ? " (optional)" : ""}
          </Label>
          {field.singleLine ? (
            <Input
              id={inputId}
              placeholder={field.placeholder}
              maxLength={maxLength}
              autoComplete="off"
              disabled={busy}
              aria-invalid={!!fieldError}
              {...form.register("value")}
            />
          ) : (
            <Textarea
              id={inputId}
              placeholder={field.placeholder}
              maxLength={maxLength}
              disabled={busy}
              aria-invalid={!!fieldError}
              {...form.register("value")}
            />
          )}
          {fieldError ? (
            <p className="text-sm text-destructive">{fieldError}</p>
          ) : field.hint ? (
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          ) : null}
        </div>

        {errorText ? (
          <p className="text-sm text-destructive" role="alert">
            {errorText}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Keep as is
          </Button>
          <Button
            type="submit"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
