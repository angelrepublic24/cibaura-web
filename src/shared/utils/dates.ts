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
 * (common/utils/business-date.ts). License-expiry gates compare date-only
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

/** Human display for an ISO instant, e.g. "Jul 30, 2026, 3:15 PM"; "—" when unset/invalid. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2d 4h" / "5h 12m" / "38m" — coarse, human countdown for a remaining span. */
export function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Numeric parts of a `YYYY-MM` string. Parts are `NaN` when the input is malformed. */
export interface IsoMonthParts {
  year: number;
  /** 1-12. */
  month: number;
}

/** Numeric parts of a `YYYY-MM-DD` string. Parts are `NaN` when the input is malformed. */
export interface IsoDateParts extends IsoMonthParts {
  /** 1-31. */
  day: number;
}

/** `Number(part)`, or `NaN` when the segment is missing. */
function segment(value: string | undefined): number {
  return value === undefined ? Number.NaN : Number(value);
}

/**
 * Split a `YYYY-MM` string into its numeric parts. Malformed input yields
 * `NaN` parts, which propagate to an Invalid Date exactly as before.
 */
export function isoMonthParts(month: string): IsoMonthParts {
  const [year, monthOfYear] = month.split("-");
  return { year: segment(year), month: segment(monthOfYear) };
}

/** Split a `YYYY-MM-DD` string into its numeric parts (see `isoMonthParts`). */
export function isoDateParts(iso: string): IsoDateParts {
  const [year, monthOfYear, dayOfMonth] = iso.split("-");
  return {
    year: segment(year),
    month: segment(monthOfYear),
    day: segment(dayOfMonth),
  };
}

/** Human display for an ISO date, e.g. "Jul 30, 2026". */
export function formatIsoDate(iso: string | undefined): string {
  if (!isIsoDate(iso)) return "—";
  const { year, month, day } = isoDateParts(iso);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
