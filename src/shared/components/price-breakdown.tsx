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

/** Display API amounts verbatim. Delivery is already part of the subtotal. */
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

  // The amount is ALWAYS the server's subtotal. The multiplication below is
  // never rendered and never replaces it — it only decides whether the row
  // may be LABELLED as a product: a delivery fee sits inside the subtotal,
  // and a booking taken before the markup moved into the daily rate can be a
  // cent off it, and in both cases "rate × days" would be a false statement.
  const exactProduct = deliveryCents === 0 && rateCents * p.days === subtotalCents;

  return (
    <dl className="space-y-1 text-sm">
      {/* Con delivery, la renta y el envío van en líneas SEPARADAS (BUG-010):
          el tester veía "Rental and delivery subtotal" como un único total sin
          desglose. El monto de la renta es subtotal − delivery, una resta de
          dos enteros DEL SERVIDOR (exacta); nunca `rate × days`, que puede caer
          un centavo por el redondeo — el mismo invariante que protege el resto
          del componente. */}
      {deliveryCents > 0 ? (
        <>
          <div className="flex justify-between gap-4">
            <dt>Rental</dt>
            <dd>{money(subtotalCents - deliveryCents)}</dd>
          </div>
          <div className="text-xs text-muted-foreground">
            <dt>Daily rate · {days}</dt>
            <dd>{money(rateCents)}/day</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Delivery</dt>
            <dd>{money(deliveryCents)}</dd>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between gap-4">
            <dt>{exactProduct ? `${money(rateCents)} × ${days}` : "Rental subtotal"}</dt>
            <dd>{money(subtotalCents)}</dd>
          </div>
          {exactProduct ? null : (
            <div className="text-xs text-muted-foreground">
              <dt>Daily rate · {days}</dt>
              <dd>{money(rateCents)}/day</dd>
            </div>
          )}
        </>
      )}
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
