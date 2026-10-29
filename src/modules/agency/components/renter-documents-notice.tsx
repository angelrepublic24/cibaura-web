"use client";

import { BellRing, CheckCircle2, FileWarning } from "lucide-react";
import {
  usePermission,
  useRemindRenterDocuments,
} from "@/modules/agency/hooks/agency.hook";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import type { Booking, BookingState } from "@/shared/types/domain";
import { useNow } from "@/shared/hooks/use-now";
import { formatDateTime, formatRemaining } from "@/shared/utils/dates";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * What each `RenterDocumentReason` code means TO THE HOST.
 *
 * Third person, and deliberately not the renter's own copy: the renter is
 * told "your licence has expired", the host is told whose problem it is and
 * nothing more. No licence number and no expiry date ever appear here — the
 * code is all the server sends, which is the point of sending a code
 * (ADR-0011).
 */
const REASON_LABELS: Record<string, string | undefined> = {
  identity_not_verified: "Their identity and licence are not verified yet",
  details_incomplete:
    "Their licence number, its expiry or their date of birth is missing",
  license_expired: "Their driver's licence has expired",
  license_expires_before_return:
    "Their licence expires before the car is due back",
};

/** Known codes keep their sentence; an unknown one still counts as missing. */
function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? "Something else on their file is missing";
}

/**
 * WHAT AN INCOMPLETE FILE MEANS IN THIS STATE — and nothing stronger.
 *
 * The documents gate (`VerificationService.assertCanRent`) runs when a
 * booking is REQUESTED, re-signed or moved to another car; it does NOT run
 * at hand-over. So this copy says the booking cannot move forward, which is
 * what the renter is told too ("Your booking is on hold"), and never claims
 * a check the server does not make. An unexpected state gets no consequence
 * sentence rather than a guessed one.
 */
const CONSEQUENCE: Partial<Record<BookingState, string>> = {
  requested:
    "This booking cannot move forward until their file is in order — including the pick-up you would be agreeing to.",
  accepted:
    "This booking cannot move forward until their file is in order. Get it fixed before the pick-up.",
  active:
    "The rental is already under way, so this needs fixing now rather than at the return.",
};

function describeRemindError(error: unknown): string {
  if (isApiErrorCode(error, API_ERROR_CODES.RENTER_DOCUMENTS_IN_ORDER)) {
    return "Nothing is missing any more — the renter's file is in order.";
  }
  if (
    isApiErrorCode(error, API_ERROR_CODES.RENTER_DOCUMENTS_REMINDER_TOO_SOON)
  ) {
    return "This renter was already reminded about this booking. Try again once the wait is over.";
  }
  if (isApiErrorCode(error, API_ERROR_CODES.RENTER_DOCUMENTS_BOOKING_CLOSED)) {
    return "This booking is closed — uploading documents cannot reopen it.";
  }
  return getErrorMessage(
    error,
    "Could not send the reminder. Please try again.",
  );
}

/**
 * "THE RENTER STILL OWES DOCUMENTS" — and the one button that does something
 * about it (`POST /agency/requests/:id/remind-renter-documents`).
 *
 * ── WHY IT IS DRIVEN ENTIRELY BY THE SERVER ───────────────────────────────
 *
 * `renterDocuments.pending` is the server's own answer to the question the
 * booking gate asks, so the button appears exactly when the nudge would be
 * true. Deriving it here from the licence dates would need the expiry that
 * this payload withholds before acceptance, and would drift from the gate
 * the first time either side moved. An ABSENT `renterDocuments` is not
 * `pending: false` — it means the route did not resolve it — so this card
 * renders nothing rather than guessing.
 *
 * ── WHY `reasons` CAN BE EMPTY WHILE PENDING IS TRUE ──────────────────────
 *
 * Before acceptance the host is outside the renter-identity window
 * (ADR-0011): they get to know THAT something is missing, not which licence
 * date says so. The card says so in that many words instead of rendering an
 * empty list that reads like a bug.
 *
 * ── THE COOLDOWN IS SHOWN, NOT DISCOVERED ─────────────────────────────────
 *
 * One reminder per booking per cooldown, enforced on the booking row so two
 * staff members clicking at once cannot both get through. `nextReminderAt`
 * is what the server will enforce, so the button is disabled until then and
 * says when it opens — a host who learns the rule from a 409 learns it as a
 * failure. The clock ticks (`useNow`), so the button re-enables on its own.
 */
export function RenterDocumentsNotice({ booking }: { booking: Booking }) {
  const now = useNow();
  const { can } = usePermission();
  const remind = useRemindRenterDocuments(booking.id);

  const status = booking.renterDocuments;
  // Absent: this response never answered the question. Not pending: there is
  // nothing to say, and the API would refuse the nudge anyway.
  if (!status?.pending) return null;

  const nextAt = status.nextReminderAt
    ? new Date(status.nextReminderAt).getTime()
    : null;
  // A malformed instant must not lock the button forever: NaN is "unknown",
  // and the server is the one that enforces the wait either way.
  const waiting = nextAt !== null && !Number.isNaN(nextAt) && nextAt > now;
  const canHandle = can("bookings:handle");
  const consequence = CONSEQUENCE[booking.state];

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
          <FileWarning className="h-4 w-4" />
          The renter still owes documents
        </CardTitle>
        <CardDescription className="text-amber-900/80">
          {consequence ? `${consequence} ` : ""}
          Sending a reminder notifies the renter; it changes nothing on the
          booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status.reasons.length > 0 ? (
          <ul className="space-y-1 text-amber-900">
            {status.reasons.map((code) => (
              <li key={code} className="flex items-start gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                {reasonLabel(code)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-amber-900">
            Something on their file is still missing. The details are shared
            with you once you accept the booking.
          </p>
        )}

        {status.lastRemindedAt ? (
          <p className="text-xs text-amber-900/80">
            Last reminded {formatDateTime(status.lastRemindedAt)}.
          </p>
        ) : null}

        {canHandle ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={waiting || remind.isPending}
              onClick={() => remind.mutate()}
            >
              <BellRing className="h-3.5 w-3.5" />
              {remind.isPending
                ? "Sending…"
                : status.lastRemindedAt
                  ? "Remind again"
                  : "Remind the renter about documents"}
            </Button>
            {waiting && nextAt !== null ? (
              <span className="text-xs text-amber-900/80">
                {/* `formatRemaining` floors to whole minutes, and "in 0m"
                    reads like a bug on a button that is still disabled. */}
                {nextAt - now < 60_000
                  ? "Already reminded — you can send another in under a minute."
                  : `Already reminded — you can send another in ${formatRemaining(nextAt - now)}.`}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-amber-900/80">
            Ask a teammate who can handle bookings to send the reminder.
          </p>
        )}

        {/* A sent reminder leaves its own trace: the booking refetches and
            `lastRemindedAt` moves, so this line is only the acknowledgement
            of the click, not the state. */}
        {remind.isSuccess ? (
          <p
            className="flex items-center gap-1.5 text-xs text-emerald-700"
            role="status"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reminder sent.
          </p>
        ) : null}

        {remind.isError ? (
          <p className="text-xs text-destructive" role="alert">
            {describeRemindError(remind.error)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
