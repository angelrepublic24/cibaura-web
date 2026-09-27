import type { Pricing } from "@/shared/types/domain";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";

/** Display API amounts verbatim. Delivery is already part of subtotal; deposit is separate. */
export function PriceBreakdown({
  pricing: p,
  depositCents,
  depositEstimate = false,
}: {
  pricing: Pricing;
  depositCents?: number;
  depositEstimate?: boolean;
}) {
  const money = (value: number) => formatMoneyCents(value, p.currency);
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between gap-4">
        <dt>Rental and delivery subtotal</dt>
        <dd>{money(p.subtotalCents)}</dd>
      </div>
      <div className="text-xs text-muted-foreground">
        <dt>
          Daily rate · {p.days} day{p.days === 1 ? "" : "s"}
        </dt>
        <dd>{money(p.ratePerDayCents)}/day</dd>
      </div>
      {p.deliveryFeeCents > 0 ? (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Delivery (included in subtotal)</dt>
          <dd>{money(p.deliveryFeeCents)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4 text-muted-foreground">
        <dt>Service fee ({formatPct(p.commissionPct)})</dt>
        <dd>{money(p.commissionCents)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Tax ({formatPct(p.taxRatePct)})</dt>
        <dd>{money(p.taxCents)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
        <dt>Total</dt>
        <dd>{money(p.totalCents)}</dd>
      </div>
      {depositCents !== undefined ? (
        <div className="flex justify-between gap-4 border-t border-border pt-2 text-muted-foreground">
          <dt>
            {depositEstimate
              ? "Estimated security deposit"
              : "Booking security deposit"}{" "}
            (held at check-in, separate from total)
          </dt>
          <dd>{money(depositCents)}</dd>
        </div>
      ) : null}
    </dl>
  );
}
