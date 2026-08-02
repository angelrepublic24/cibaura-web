/**
 * Small date helpers for URL params and calendar placeholders.
 * These format/parse dates ONLY — rental-day counts and prices are
 * computed by the backend (see the pricing invariant).
 */

/** Format a Date as the ISO date (YYYY-MM-DD) the API and URLs use. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Loose YYYY-MM-DD validation for values coming from the URL. */
export function isIsoDate(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Today as YYYY-MM-DD (local time). */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/**
 * The platform's business timezone — must match the backend
 * (common/utils/business-date.ts). Licence-expiry gates compare date-only
 * values, so the client must anchor "today" on the SAME calendar day the
 * authoritative server uses, not the device-local day (which diverges from the
 * server near midnight in UTC-negative markets like the DR).
 */
export const BUSINESS_TIMEZONE = "America/Santo_Domingo";

/** Today as YYYY-MM-DD in the business timezone (mirrors the server). */
export function businessTodayIso(timeZone: string = BUSINESS_TIMEZONE): string {
  // en-CA renders as YYYY-MM-DD; `timeZone` resolves the wall-clock date there.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current month as YYYY-MM (used by availability queries). */
export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

/** Human display for an ISO date, e.g. "Jul 30, 2026". */
export function formatIsoDate(iso: string | undefined): string {
  if (!isIsoDate(iso)) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
