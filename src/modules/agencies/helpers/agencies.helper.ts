import { businessTodayIso } from "@/shared/utils/dates";

/**
 * Pure agency helpers. No API or service calls here. The identity-document
 * rules (which ID a host may present, and whether its number is well formed)
 * are their own cohesive concern in `@/modules/agencies/helpers/identity-document.helper.helper`.
 */

/** Dominican cedula: 3-7-1 digits, dashes optional (`001-1234567-8`). */
export const CEDULA_REGEX = /^\d{3}-?\d{7}-?\d$/;

/** Hosts must be adults — the backend rejects a younger date of birth. */
export const MIN_HOST_AGE_YEARS = 18;

/** The wire form of a cedula: digits only (the server normalizes the same way). */
export function normalizeCedula(value: string): string {
  return value.replace(/-/g, "");
}

/** Latest acceptable date of birth (today - MIN_HOST_AGE_YEARS, business tz). */
export function latestHostDateOfBirthIso(): string {
  const today = businessTodayIso();
  const year = Number(today.slice(0, 4)) - MIN_HOST_AGE_YEARS;
  return `${year}${today.slice(4)}`;
}
