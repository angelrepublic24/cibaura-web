import type { Pricing } from "@/shared/types/domain";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";

/**
 * Who is reading the snapshot. A RENTER sees only `renter*` amounts and no
 * commission line at all — the platform's cut lives inside the daily rate
 * they are quoted. A HOST (and an admin) sees their own `host*` base, the
 * commission and the same total. Both halves come from the same server
 * snapshot; nothing here is derived.
 */
export type PriceBreakdownViewer = "renter" | "host";

/** The hold placed at check-in — returned, and never part of any total. */
export interface BreakdownDeposit {
  cents: number;
  /** Server-decided (`depositCents > 0`); `false` = this host asks for none. */
  required: boolean;
  /** Quote-time figure, confirmed when the booking is created. */
  estimate?: boolean;
}

/**
 * Display API amounts verbatim. Delivery is already part of the subtotal, so
 * the CAR's own cost is the subtotal with the fee taken back out — see
 * `rentalCents` below for why that subtraction is the only arithmetic here.
 */
export function PriceBreakdown({
  pricing: p,
  viewer,
  deposit,
}: {
  pricing: Pricing;
  viewer: PriceBreakdownViewer;
  deposit?: BreakdownDeposit;
}) {
  const money = (value: number) => formatMoneyCents(value, p.currency);
  const days = `${p.days} day${p.days === 1 ? "" : "s"}`;
  const renter = viewer === "renter";

  const deliveryCents = renter
    ? p.renterDeliveryFeeCents
    : p.hostDeliveryFeeCents;
  const rateCents = renter ? p.renterDailyRateCents : p.hostDailyRateCents;
  const subtotalCents = renter ? p.renterSubtotalCents : p.hostSubtotalCents;

  /*
   * WHAT THE CAR ITSELF COSTS (BUG-002).
   *
   * The delivery fee sits INSIDE the server's subtotal, so a row labelled for
   * the rental has to take it back out. This subtraction is the only
   * arithmetic in the component and it is exact by contract — two integers
   * the server sent, where `subtotal = rate × days + deliveryFee` — so it
   * cannot drift from the figure that was charged the way `rate × days`
   * could.
   *
   * What it buys is a breakdown that ADDS UP on screen: rental + delivery is
   * the subtotal, and the subtotal + tax is the total. The row this replaced
   * carried the subtotal WITH the delivery inside it, so a reader who added
   * the lines up got the fee twice — and a reader who did not was left
   * reading one opaque figure for two different things.
   */
  const rentalCents = subtotalCents - deliveryCents;

  /*
   * Whether the rental row may be LABELLED as a product. The amount is always
   * the server's; this only decides the words next to it, because a booking
   * taken before the markup moved into the daily rate can sit a cent off the
   * product, and "rate × days" would then be a false statement printed beside
   * a true amount. Checked against the RENTAL, not the subtotal: a delivery
   * fee no longer disqualifies the label, it is just its own line.
   */
  const exactProduct = rateCents * p.days === rentalCents;

  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between gap-4">
        <dt>
          {exactProduct ? `${money(rateCents)}/day × ${days}` : `Rental · ${days}`}
        </dt>
        <dd>{money(rentalCents)}</dd>
      </div>
      {/* Only when the label above could not say it: the renter still needs
          the per-day figure, and this states it without claiming it
          multiplies out to the amount. */}
      {exactProduct ? null : (
        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <dt>Daily rate</dt>
          <dd>{money(rateCents)}/day</dd>
        </div>
      )}
      {deliveryCents > 0 ? (
        <div className="flex justify-between gap-4">
          <dt>Delivery</dt>
          <dd>{money(deliveryCents)}</dd>
        </div>
      ) : null}
      {renter ? null : (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Platform service fee ({formatPct(p.commissionPct)})</dt>
          <dd>{money(p.commissionCents)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt>Tax ({formatPct(p.taxRatePct)})</dt>
        <dd>{money(p.taxCents)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
        <dt>Total</dt>
        <dd>{money(p.totalCents)}</dd>
      </div>
      {deposit ? (
        <div className="flex justify-between gap-4 border-t border-border pt-2 text-muted-foreground">
          <dt>{depositLabel(deposit, renter)}</dt>
          <dd>{deposit.required ? money(deposit.cents) : "—"}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * A deposit is a hold, not a charge, and the copy has to say so next to the
 * total it is deliberately NOT part of. "No deposit" is a real answer here,
 * not a missing value — some hosts ask for none.
 */
function depositLabel(deposit: BreakdownDeposit, renter: boolean): string {
  if (!deposit.required) {
    return renter ? "No deposit required" : "No security deposit on this booking";
  }
  const held = renter
    ? "held at check-in and returned, separate from the total"
    : "held on the customer's card at check-in, separate from the total";
  const what = deposit.estimate
    ? "Estimated security deposit"
    : "Security deposit";
  return `${what} (${held})`;
}
