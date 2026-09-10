import { z } from "zod";
import {
  acceptTermsSchema,
  PHONE_MESSAGE,
  PHONE_REGEX,
} from "@/features/auth/schemas";
import { businessTodayIso } from "@/shared/utils/dates";

/**
 * Zod schemas for the individual-host onboarding (ADR-0009). Bounds mirror
 * the backend `ApplyIndividualHostDto` (spec §4/B6) so a bad value fails
 * client-side first; the server re-validates everything.
 */

/** Dominican cédula: 3-7-1 digits, dashes optional (`001-1234567-8`). */
export const CEDULA_REGEX = /^\d{3}-?\d{7}-?\d$/;

/** Hosts must be adults — the backend rejects a younger date of birth. */
export const MIN_HOST_AGE_YEARS = 18;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The wire form of a cédula: digits only (the server normalizes the same way). */
export function normalizeCedula(value: string): string {
  return value.replace(/-/g, "");
}

/** Latest acceptable date of birth (today − MIN_HOST_AGE_YEARS, business tz). */
export function latestHostDateOfBirthIso(): string {
  const today = businessTodayIso();
  const year = Number(today.slice(0, 4)) - MIN_HOST_AGE_YEARS;
  return `${year}${today.slice(4)}`;
}

export const cedulaSchema = z
  .string()
  .trim()
  .regex(CEDULA_REGEX, "Enter your cédula, e.g. 001-1234567-8");

export const hostDateOfBirthSchema = z
  .string()
  .regex(DATE_ONLY, "Enter your date of birth")
  .refine((v) => v <= latestHostDateOfBirthIso(), {
    message: `You must be at least ${MIN_HOST_AGE_YEARS} years old to host`,
  });

/** Step 1 — personal data + Terms consent. */
export const hostPersonalSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Enter your first name")
    .max(80, "At most 80 characters"),
  lastName: z
    .string()
    .trim()
    .min(2, "Enter your last name")
    .max(80, "At most 80 characters"),
  idNumber: cedulaSchema,
  dateOfBirth: hostDateOfBirthSchema,
  phone: z.string().trim().regex(PHONE_REGEX, PHONE_MESSAGE),
  acceptTerms: acceptTermsSchema,
});
export type HostPersonalValues = z.infer<typeof hostPersonalSchema>;

/**
 * Step 2 — the single pickup/delivery address. `lat/lng` come from the
 * Places autocomplete (the backend needs coordinates for the delivery
 * origin); a hand-typed line without a picked suggestion is rejected.
 */
export const hostAddressSchema = z
  .object({
    cityId: z.string().min(1, "Pick your city"),
    line: z
      .string()
      .trim()
      .min(5, "Enter your street address")
      .max(300, "At most 300 characters"),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    reference: z.string().trim().max(300, "At most 300 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.lat === null || v.lng === null) {
      ctx.addIssue({
        code: "custom",
        path: ["line"],
        message: "Pick your address from the suggestions so we can locate it",
      });
    }
  });
export type HostAddressValues = z.infer<typeof hostAddressSchema>;
