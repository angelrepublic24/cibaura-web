"use client";

import { useState } from "react";

import { CheckCircle2, KeyRound } from "lucide-react";
import { useConfirmHandover } from "@/modules/agency/hooks/agency.hook";

import { usePermission } from "@/modules/agency/hooks/agency.hook";
import type { BookingDetail } from "@/shared/types/domain";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { formatDateTime } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
/** Exactly six digits — the shape the server mints and the only thing it accepts. */
const CODE_LENGTH = 6;

/**
 * THE HAND-OVER CODE, entered by the host at the counter.
 *
 * The renter reads out six digits that only their own app and their
 * confirmation email carry. Until they match, the booking cannot be marked
 * picked up — so this is what proves the person collecting the car is the
 * person who booked it, and it is what releases the rest of the money.
 *
 * A separate step from recording the pick-up on purpose: two different
 * actions move a booking into `active` (this button's, and finalizing the
 * check-in inspection), and both read the stamp this writes.
 */
export function HandoverCodeEntry({ booking }: { booking: BookingDetail }) {
  const { can } = usePermission();
  const [code, setCode] = useState("");

  // The hook refreshes the booking; clearing the box is ours.
  const confirmHandover = useConfirmHandover(booking.id);
  const confirm = {
    isPending: confirmHandover.isPending,
    isError: confirmHandover.isError,
    error: confirmHandover.error,
    mutate: () =>
      confirmHandover.mutate(code, { onSuccess: () => setCode("") }),
  };

  // Walk-ins carry no code: the renter is already at the counter and the
  // agency typed the booking itself, so there is nothing to confirm. Show
  // no box rather than one nothing will ever open.
  if (!booking.handover.codeRequired) return null;
  if (booking.state !== "accepted") return null;

  if (booking.handover.confirmedAt) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Hand-over confirmed by the renter on{" "}
            {formatDateTime(booking.handover.confirmedAt)}. You can record the
            pick-up.
          </p>
        </CardContent>
      </Card>
    );
  }

  const complete = isSixDigits(code);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-primary" aria-hidden />
          Confirm the hand-over
        </CardTitle>
        <CardDescription>
          Ask the renter for the six-digit code in their booking and enter it
          here. The rental cannot start without it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!can("bookings:handle") ? (
          <p className="text-sm text-muted-foreground">
            You need the &quot;Accept / reject bookings&quot; permission to
            confirm a hand-over.
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (complete && !confirm.isPending) confirm.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="handover-code">Hand-over code</Label>
              <Input
                id="handover-code"
                inputMode="numeric"
                autoComplete="off"
                maxLength={CODE_LENGTH}
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="w-40 font-mono text-lg tracking-[0.2em] tabular-nums"
              />
            </div>
            <Button type="submit" disabled={!complete || confirm.isPending}>
              {confirm.isPending ? "Checking…" : "Confirm"}
            </Button>
          </form>
        )}
        {confirm.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeError(confirm.error)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Six digits and nothing else — spelled out rather than written as a
 * pattern, because the person maintaining this should be able to read what
 * it accepts without decoding anything.
 */
function isSixDigits(value: string): boolean {
  if (value.length !== CODE_LENGTH) return false;
  return [...value].every((character) => character >= "0" && character <= "9");
}

/**
 * Each refusal says what the host should DO next — they are standing in
 * front of a customer, and "request failed" is not an instruction.
 *
 * The lock carries its remaining minutes in the server's message, so that
 * one is shown verbatim rather than replaced with copy that would have to
 * guess the wait.
 */
function describeError(error: unknown): string {
  if (isApiErrorCode(error, API_ERROR_CODES.HANDOVER_CODE_MISMATCH)) {
    return "That code does not match this booking. Ask the renter to read it out again from their app.";
  }
  if (isApiErrorCode(error, API_ERROR_CODES.HANDOVER_CODE_LOCKED)) {
    return getErrorMessage(
      error,
      "Too many wrong codes. Wait a few minutes and try again.",
    );
  }
  if (isApiErrorCode(error, API_ERROR_CODES.HANDOVER_CODE_NOT_APPLICABLE)) {
    return "This booking has no hand-over code — record the pick-up directly.";
  }
  return getErrorMessage(error, "Could not confirm the hand-over.");
}
