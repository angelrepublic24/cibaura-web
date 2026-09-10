"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AgencyApi } from "@/features/agency/api";
import { invalidateAgencyBooking } from "@/features/agency/hooks";
import { usePermission } from "@/features/agency/use-permission";
import type { Booking } from "@/shared/types/domain";
import { API_ERROR_CODES, isApiErrorCode } from "@/shared/api/errors";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type LifecycleAction = "accept" | "reject";

/** Backend `RejectBookingDto` / `CancelBookingDto`: reason 2..160. */
const REASON_MIN = 2;
const REASON_MAX = 160;

/**
 * Agency-side booking lifecycle actions:
 *
 *  - requested: Accept / Reject (reject asks for a reason)
 *  - accepted:  "Cancel booking" (reason required; customer refunded 100%)
 *  - active:    "Cancel booking" (mid-rental; reason required; full refund)
 *
 * Pickup, return and settlement are no longer one-click buttons: the
 * check-in / check-out inspections (ADR-0011) move the booking and the
 * settlement card (ADR-0012) closes it, both on the booking detail. From
 * the inbox (`surface="inbox"`) those states link to the detail instead.
 *
 * Requires `bookings:handle` (renders nothing without it — the backend
 * enforces it anyway). Every success invalidates the whole agency cache
 * (inbox, calendar, wallet) plus the booking detail.
 */
export function BookingLifecycleActions({
  booking,
  surface = "detail",
}: {
  booking: Booking;
  surface?: "inbox" | "detail";
}) {
  const qc = useQueryClient();
  const { can } = usePermission();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (action: LifecycleAction) =>
      action === "accept"
        ? AgencyApi.acceptRequest(booking.id)
        : AgencyApi.rejectRequest(booking.id, reason.trim() || "declined"),
    onSuccess: () => {
      setRejecting(false);
      setReason("");
      invalidateAgencyBooking(qc, booking.id);
    },
  });

  if (!can("bookings:handle")) return null;

  const busy = mutation.isPending;
  const detailHref = `/agency/requests/${booking.id}`;

  const cancelButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      className="text-destructive hover:text-destructive"
      onClick={() => setCancelOpen(true)}
    >
      Cancel booking
    </Button>
  );

  const detailLink = (label: string) => (
    <Link href={detailHref} className={buttonVariants({ size: "sm" })}>
      {label}
    </Link>
  );

  let actions: React.ReactNode = null;

  switch (booking.state) {
    case "requested":
      actions = rejecting ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor={`reason-${booking.id}`}>Reason for rejection</Label>
          <Input
            id={`reason-${booking.id}`}
            placeholder="e.g. Car unavailable for these dates"
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => mutation.mutate("reject")}
            >
              {busy ? "Rejecting…" : "Confirm reject"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => mutation.mutate("accept")}>
            {busy ? "Accepting…" : "Accept"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        </div>
      );
      break;
    case "accepted":
      actions = (
        <div className="flex flex-wrap items-start gap-2">
          {surface === "inbox" ? detailLink("Open check-in") : null}
          {cancelButton}
        </div>
      );
      break;
    case "active":
      actions = (
        <div className="flex flex-wrap items-start gap-2">
          {surface === "inbox" ? detailLink("Open check-out") : null}
          {cancelButton}
        </div>
      );
      break;
    case "returned":
      if (surface !== "inbox") return null;
      actions = detailLink("Review settlement");
      break;
    default:
      // Terminal states (settled/rejected/expired/cancelled): nothing to do.
      return null;
  }

  return (
    <div className="space-y-2">
      {actions}
      {mutation.isError ? (
        <p className="text-sm text-destructive">
          {isApiErrorCode(mutation.error, API_ERROR_CODES.PERIOD_ALREADY_STARTED)
            ? "The rental start date has already passed — this request can no longer be accepted."
            : mutation.error.message}
        </p>
      ) : null}

      <ReasonDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={
          booking.state === "active"
            ? "Cancel this rental now?"
            : "Cancel this booking?"
        }
        description="The customer will be refunded in full. This cannot be undone."
        field={{
          label: "Reason",
          placeholder:
            booking.state === "active"
              ? "e.g. Car returned early after a breakdown"
              : "e.g. The car needs unexpected repairs",
          hint: "Shown to the customer with the cancellation notice.",
          minLength: REASON_MIN,
          maxLength: REASON_MAX,
        }}
        confirmLabel="Cancel booking"
        destructive
        onConfirm={async (value) => {
          const text = value ?? "";
          if (booking.state === "active") {
            await AgencyApi.cancelActiveBooking(booking.id, text);
          } else {
            await AgencyApi.cancelBooking(booking.id, text);
          }
          invalidateAgencyBooking(qc, booking.id);
        }}
      />
    </div>
  );
}
