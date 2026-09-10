/**
 * Booking rejection / cancellation reasons. The backend stores either a
 * MACHINE reason (one of the literals below, set by jobs and automatic
 * transitions) or free text typed by a person. Machine reasons map to copy
 * here; anything else is shown verbatim. Mirrors DOMAIN.md "Machine booking
 * reasons" — keep the literals in lockstep with the backend.
 */
const MACHINE_REASONS: Record<string, string> = {
  no_longer_available: "The car was no longer available for these dates.",
  request_expired: "The agency did not respond before the request expired.",
  payment_failed: "The card could not be authorized.",
  payment_canceled: "The payment was cancelled before the agency replied.",
  account_deleted: "The customer's account was deleted.",
  period_started:
    "The rental start date passed before the request was accepted.",
};

/** Human copy for a stored reason, or the raw text when it was typed by a person. */
export function describeBookingReason(reason: string): string {
  return MACHINE_REASONS[reason] ?? reason;
}

/**
 * The single reason worth showing for a closed booking: a rejected booking
 * carries `rejectionReason`, a cancelled one `cancellationReason`. Null when
 * neither is set (e.g. an expiry with no reason recorded).
 */
export function closedBookingReason(booking: {
  rejectionReason: string | null;
  cancellationReason: string | null;
}): string | null {
  const raw = booking.rejectionReason ?? booking.cancellationReason;
  return raw ? describeBookingReason(raw) : null;
}
