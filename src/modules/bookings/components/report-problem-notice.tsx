"use client";

import { TriangleAlert } from "lucide-react";
import { supportReportMailto } from "@/modules/bookings/helpers/support-report.helper";
import { SUPPORT_EMAIL } from "@/shared/config/support";
import type { BookingDetail } from "@/shared/types/domain";
import { buttonVariants } from "@/shared/components/ui/button";

/**
 * The exit for a customer whose car was never handed over.
 *
 * It sits directly above the cancel row, because the whole point is to be
 * read before that button is pressed: cancelling here is a LATE cancellation
 * and retains a share of the subtotal for the agency that did not turn up,
 * while an admin cancelling the same booking refunds everything. The customer
 * cannot see that difference anywhere else on the page.
 *
 * Deliberately not a ticketing system. With sixteen agencies support handles
 * these by hand, so this is the path to a human and nothing more — a
 * `mailto:` carrying the booking facts, plus the address as selectable text
 * for a device with no mail client configured.
 *
 * `role="note"` rather than `alert` or `status`: the block appears because a
 * date passed, not because the customer did anything, so it must not barge
 * into a screen reader mid-sentence when the clock crosses midnight.
 */
export function ReportProblemNotice({
  booking,
  retentionPct,
}: {
  booking: BookingDetail;
  /** Live policy figure; omitted while `GET /legal/current` is in flight. */
  retentionPct?: number;
}) {
  const cost =
    retentionPct !== undefined
      ? `${retentionPct}% of the rental subtotal`
      : "a share of the rental subtotal";

  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-warning/40 bg-warning-soft p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-warning">
            Nobody there to hand over the car?
          </p>
          <p className="text-sm text-muted-foreground">
            Do not cancel yet. Cancelling now counts as a late cancellation and
            keeps {cost} for {booking.agency.name}. Tell us instead: if the
            agency did not deliver the car, our team cancels the booking for
            you with a <span className="font-medium">full refund</span>, back
            on your card within a few business days.
          </p>
          <p className="text-sm text-muted-foreground">
            Or write to{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary underline underline-offset-2"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            quoting booking {booking.id}.
          </p>
        </div>
      </div>
      <a
        href={supportReportMailto(booking)}
        className={buttonVariants({ size: "sm" })}
      >
        Report a problem
      </a>
    </div>
  );
}
