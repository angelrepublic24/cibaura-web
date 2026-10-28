import { SUPPORT_EMAIL } from "@/shared/config/support";
import type { BookingDetail } from "@/shared/types/domain";
import { businessTodayIso } from "@/shared/utils/dates";

/**
 * The customer's way to reach a human about a booking.
 *
 * WHY THIS EXISTS: an `accepted` booking is already charged and holds the
 * car. If the agency never turns up, the only control the customer can see is
 * Cancel — and cancelling past the free window retains
 * `lateCancellationRetentionPct` of the subtotal FOR THE AGENCY. So the
 * person who was left waiting pays for it. An admin cancelling the same
 * booking refunds 100% and retains nothing, but nothing on the page leads
 * there. `/legal/terms` already promises that outcome ("fails to deliver the
 * vehicle as agreed … you receive a full refund regardless of timing"); this
 * is the missing path to claim it.
 */

/**
 * The window where the warning belongs: the agency accepted (so the card was
 * captured and the car is held) and the pickup day has arrived or gone by.
 *
 * `accepted` IS "not picked up": `pickedUpAt` is stamped only by the
 * `accepted → active` transition, so the state alone carries it. The booking
 * period is date-only — there is no pickup time anywhere on the wire — so the
 * pickup DAY is the finest grain available, compared in the platform's
 * business timezone exactly as `inspection-panel` does for check-in.
 *
 * Before that day this is noise: a customer two weeks out has nothing to
 * report. After it, it is the only thing on the page worth reading.
 */
export function isAwaitingHandover(booking: BookingDetail): boolean {
  return booking.state === "accepted" && businessTodayIso() >= booking.period.start;
}

/**
 * A `mailto:` carrying everything an admin needs to act without a reply:
 * which booking, which agency, which dates, and where the customer was
 * supposed to collect the car. The admin console opens at
 * `/admin/orders/<id>`, so the id is the first line.
 *
 * Prefilling is new here — the repo's other `mailto:` links are bare — which
 * is why it is one named builder rather than string concatenation at the call
 * site. The query is built with `URLSearchParams` so an agency name with an
 * ampersand cannot truncate the body. The address itself is left raw: it
 * passed `z.email()` in `shared/config/support`, so it carries nothing that
 * needs escaping, and `%40` confuses some mail clients.
 */
export function supportReportMailto(booking: BookingDetail): string {
  const pickup =
    booking.pickup.type === "delivery"
      ? (booking.pickup.deliveryAddress ??
        booking.pickup.deliveryZoneName ??
        "Delivery")
      : `${booking.branch.name} (branch pickup)`;

  const body = [
    "Hello,",
    "",
    "Nobody was there to hand over the car for this booking.",
    "",
    `Booking: ${booking.id}`,
    `Agency: ${booking.agency.name}`,
    `Dates: ${booking.period.start} to ${booking.period.end}`,
    `Pickup: ${pickup}`,
    "",
    "What happened:",
    "",
  ].join("\n");

  const query = new URLSearchParams({
    subject: `No-show at pickup — booking ${booking.id}`,
    body,
  });
  // URLSearchParams encodes spaces as "+", which mail clients keep literally
  // in a mailto body; %20 is the form every client agrees on.
  return `mailto:${SUPPORT_EMAIL}?${query.toString().replace(/\+/g, "%20")}`;
}
