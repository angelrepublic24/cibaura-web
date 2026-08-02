/**
 * Money display helpers.
 *
 * INVARIANT (README #2): pricing is 100% server-side. All money arrives
 * from the API as integer cents inside a frozen pricing snapshot. The
 * client's only job is FORMATTING cents for display — it never adds,
 * multiplies or derives amounts. If you find yourself computing
 * `days * rate` in the frontend, stop: request a quote from the backend.
 */

const DEFAULT_CURRENCY = "DOP"; // v1 market: Dominican Republic
const LOCALE_BY_CURRENCY: Record<string, string> = {
  DOP: "es-DO",
  USD: "en-US",
};

/** Format integer cents as a currency string, e.g. 525000 -> "RD$5,250.00". */
export function formatMoneyCents(
  cents: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (!Number.isFinite(cents)) return "—";
  const amount = Math.trunc(cents) / 100;
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Format a commission percentage (e.g. 12.5 -> "12.5%"). Display only. */
export function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct}%`;
}

/**
 * Unit conversion at INPUT boundaries only (e.g. the agency types a
 * per-day price of "45" -> 4500 cents to send to the API). This is not
 * price computation — it converts the unit of a value a human entered.
 */
export function wholeUnitsToCents(units: number): number {
  return Math.round(units * 100);
}
