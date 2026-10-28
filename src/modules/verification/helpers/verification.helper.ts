import type { CustomerVerification } from "@/shared/types/domain";
import { businessTodayIso } from "@/shared/utils/dates";

/**
 * Pure verification helpers. No API or service calls here.
 */

/** The platform floor. Agencies enforce their own, higher, minimum age. */
export const MIN_AGE_YEARS = 16;

/** Latest acceptable date of birth (today minus MIN_AGE_YEARS, business tz). */
export function maxDateOfBirthIso(): string {
  const today = businessTodayIso();
  const year = Number(today.slice(0, 4)) - MIN_AGE_YEARS;
  return `${year}${today.slice(4)}`;
}

/**
 * Date-of-birth presence, read DEFENSIVELY: "on file" only when the wire
 * carries a real string; "missing" for `null` AND for an absent field (a
 * backend that does not emit it yet). An absent field must never lock the
 * input or block the submit — the server still validates the value.
 */
export function hasDateOfBirth(v: CustomerVerification): boolean {
  return typeof v.dateOfBirth === "string";
}

export function isDateOfBirthMissing(v: CustomerVerification): boolean {
  return v.dateOfBirth == null;
}

/** "Mar 4, 2026" for an upload timestamp; "—" when the wire is unparseable. */
export function formatUploaded(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
