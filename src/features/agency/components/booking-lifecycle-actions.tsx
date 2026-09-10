"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import { bookingKeys } from "@/features/bookings/api";
import type { Booking } from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type LifecycleAction = "accept" | "reject" | "pickup" | "return" | "settle";

/** Pending inline flow: the reject-reason form or a confirm step. */
type Mode = null | "reject" | "confirm-pickup" | "confirm-return" | "confirm-settle";

/**
 * Agency-side booking lifecycle actions — the ONE component that moves a
 * booking through requested → accepted → active → returned → settled:
 *
 *  - requested: Accept / Reject (reject asks for a reason)
 *  - accepted:  "Mark picked up"  (confirm — the rental becomes active)
 *  - active:    "Mark returned"   (confirm — the car is back)
 *  - returned:  "Settle payout"   (confirm — releases earnings to the wallet)
 *
 * Rendered in the requests inbox rows AND the agency booking detail. Requires
 * the `bookings:handle` permission (renders nothing without it — the backend
 * enforces it anyway). Every success invalidates the whole agency cache
 * (inbox, calendar, wallet) plus the booking detail/timeline, so revenue and
 * progress update everywhere at once.
 */
export function BookingLifecycleActions({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const { can } = usePermission();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (action: LifecycleAction) => {
      switch (action) {
        case "accept":
          return AgencyApi.acceptRequest(booking.id);
        case "reject":
          return AgencyApi.rejectRequest(booking.id, reason.trim() || "declined");
        case "pickup":
          return AgencyApi.pickupRequest(booking.id);
        case "return":
          return AgencyApi.returnRequest(booking.id);
        case "settle":
          return AgencyApi.settleRequest(booking.id);
      }
    },
    onSuccess: () => {
      setMode(null);
      setReason("");
      // Inbox lists, calendar occupancy and the wallet all shift on a
      // lifecycle transition; the detail view reads bookingKeys.detail.
      qc.invalidateQueries({ queryKey: agencyKeys.all });
      qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });

  if (!can("bookings:handle")) return null;

  const busy = mutation.isPending;

  const confirm = (
    label: string,
    hint: string,
    action: LifecycleAction,
    confirmMode: Exclude<Mode, null | "reject">,
  ) =>
    mode === confirmMode ? (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => mutation.mutate(action)}>
            {busy ? "Saving…" : `Confirm — ${label.toLowerCase()}`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setMode(null)}
          >
            Cancel
          </Button>
        </div>
      </div>
    ) : (
      <Button size="sm" disabled={busy} onClick={() => setMode(confirmMode)}>
        {label}
      </Button>
    );

  let actions: React.ReactNode = null;

  switch (booking.state) {
    case "requested":
      actions =
        mode === "reject" ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor={`reason-${booking.id}`}>Reason for rejection</Label>
            <Input
              id={`reason-${booking.id}`}
              placeholder="e.g. Car unavailable for these dates"
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
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => mutation.mutate("accept")}
            >
              {busy ? "Accepting…" : "Accept"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setMode("reject")}
            >
              Reject
            </Button>
          </div>
        );
      break;
    case "accepted":
      actions = confirm(
        "Mark picked up",
        "The customer collected the car — the rental becomes active.",
        "pickup",
        "confirm-pickup",
      );
      break;
    case "active":
      actions = confirm(
        "Mark returned",
        "The car is back with you — the rental is over.",
        "return",
        "confirm-return",
      );
      break;
    case "returned":
      actions = confirm(
        "Settle payout",
        "Closes the booking and releases your earnings to the wallet.",
        "settle",
        "confirm-settle",
      );
      break;
    default:
      // Terminal states (settled/rejected/expired/cancelled): nothing to do.
      return null;
  }

  return (
    <div className="space-y-2">
      {actions}
      {mutation.isError ? (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      ) : null}
    </div>
  );
}
