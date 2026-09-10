"use client";

import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminApi, adminKeys, type DecideClaimInput } from "@/features/admin/api";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type { ClaimAdminDto } from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  centsToWholeUnitsInput,
  formatMoneyCents,
  wholeUnitsToCents,
} from "@/shared/utils/money";

/** Backend `DecideClaimDto`: approvedCents ≥ 0, note 2..1000 (spec §4/B9). */
const NOTE_MIN = 2;
const NOTE_MAX = 1000;

const decideSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  /** Whole currency units typed by the admin; converted to cents on submit. */
  amount: z.string().trim(),
  note: z
    .string()
    .trim()
    .min(NOTE_MIN, `At least ${NOTE_MIN} characters`)
    .max(NOTE_MAX, `At most ${NOTE_MAX} characters`),
});
type DecideFormValues = z.infer<typeof decideSchema>;

/** Copy for the decide-time backend codes (spec §0.2). */
function describeDecideError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.CLAIM_NOT_OPEN:
      return "This claim was already decided or withdrawn — refresh the page.";
    case API_ERROR_CODES.CLAIM_AMOUNT_EXCEEDS_LIMIT:
      return "The approved amount exceeds what can be claimed for this booking.";
    case API_ERROR_CODES.DEPOSIT_NOT_CAPTURABLE:
      return "The deposit is no longer held, so nothing can be captured. The claim can still be approved as uncollectible.";
    default:
      return getErrorMessage(error, "Could not record the decision.");
  }
}

/**
 * Admin decision on a damage claim (ADR-0013): approve up to the amount the
 * held deposit covers (the server captures `min(approved, deposit)`; the
 * excess is recorded as uncollected) or reject with a note. Both outcomes
 * trigger the settlement attempt server-side.
 */
export function ClaimDecideDialog({
  open,
  onClose,
  claim,
}: {
  open: boolean;
  onClose: () => void;
  claim: ClaimAdminDto;
}) {
  const qc = useQueryClient();
  const deposit = claim.deposit;
  const currency = deposit?.currency ?? "USD";
  const depositHeld = deposit?.status === "held";
  // Cap: never more than requested, and never more than the deposit covers.
  const capCents =
    deposit && deposit.amountCents > 0
      ? Math.min(claim.requestedCents, deposit.amountCents)
      : claim.requestedCents;

  const schema = decideSchema.superRefine((values, ctx) => {
    if (values.decision !== "approve") return;
    if (!/^\d+(\.\d{1,2})?$/.test(values.amount)) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Enter an amount (up to 2 decimals)",
      });
      return;
    }
    const cents = wholeUnitsToCents(Number(values.amount));
    if (cents < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Approve at least 0.01, or reject the claim",
      });
    } else if (cents > capCents) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: `At most ${formatMoneyCents(capCents, currency)}`,
      });
    }
  });

  const form = useForm<DecideFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      decision: "approve",
      amount: centsToWholeUnitsInput(capCents),
      note: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (input: DecideClaimInput) => AdminApi.decideClaim(claim.id, input),
    onSuccess: (next) => {
      qc.setQueryData(adminKeys.claim(claim.id), next);
      qc.invalidateQueries({ queryKey: adminKeys.claims() });
      qc.invalidateQueries({ queryKey: adminKeys.booking(claim.bookingId) });
      onClose();
    },
  });

  const { reset } = form;
  const { reset: resetMutation } = mutation;
  useEffect(() => {
    if (open) {
      reset({
        decision: "approve",
        amount: centsToWholeUnitsInput(capCents),
        note: "",
      });
      resetMutation();
    }
  }, [open, reset, resetMutation, capCents]);

  const decision = form.watch("decision");
  const busy = mutation.isPending;
  const errors = form.formState.errors;
  const approveId = useId();
  const rejectId = useId();
  const amountId = useId();
  const noteId = useId();

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Decide this claim"
      description={`${claim.agencyName} requested ${formatMoneyCents(claim.requestedCents, currency)} from ${claim.customerName}.`}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate({
            approvedCents:
              values.decision === "approve"
                ? wholeUnitsToCents(Number(values.amount))
                : 0,
            note: values.note,
          }),
        )}
      >
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Decision
          </legend>
          <label htmlFor={approveId} className="flex items-center gap-2 text-sm">
            <input
              id={approveId}
              type="radio"
              value="approve"
              disabled={busy}
              {...form.register("decision")}
            />
            Approve an amount
          </label>
          <label htmlFor={rejectId} className="flex items-center gap-2 text-sm">
            <input
              id={rejectId}
              type="radio"
              value="reject"
              disabled={busy}
              {...form.register("decision")}
            />
            Reject the claim
          </label>
        </fieldset>

        {decision === "approve" ? (
          <div className="space-y-1.5">
            <Label htmlFor={amountId}>Approved amount ({currency})</Label>
            <Input
              id={amountId}
              inputMode="decimal"
              className="max-w-[180px]"
              disabled={busy}
              aria-invalid={!!errors.amount}
              {...form.register("amount")}
            />
            {errors.amount ? (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Up to {formatMoneyCents(capCents, currency)}
                {deposit
                  ? ` — the deposit is ${formatMoneyCents(deposit.amountCents, currency)}.`
                  : "."}
              </p>
            )}
            {!depositHeld ? (
              <p
                className="rounded-[var(--radius-sm)] border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning"
                role="status"
              >
                The deposit is not held right now, so nothing will be captured:
                the claim closes as approved but uncollectible and collection
                happens off-platform.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor={noteId}>Decision note</Label>
          <Textarea
            id={noteId}
            maxLength={NOTE_MAX}
            placeholder={
              decision === "approve"
                ? "What the evidence showed and how the amount was set."
                : "Why the claim is rejected."
            }
            disabled={busy}
            aria-invalid={!!errors.note}
            {...form.register("note")}
          />
          {errors.note ? (
            <p className="text-sm text-destructive">{errors.note.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Shown to both the host and the customer.
            </p>
          )}
        </div>

        {mutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeDecideError(mutation.error)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Not now
          </Button>
          <Button
            type="submit"
            variant={decision === "reject" ? "destructive" : "default"}
            disabled={busy}
          >
            {busy
              ? "Recording…"
              : decision === "reject"
                ? "Reject claim"
                : "Approve claim"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
