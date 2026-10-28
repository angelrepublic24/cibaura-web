import { z } from "zod";
import { CUSTOMER_DOCUMENT_TYPES } from "@/shared/types/domain";
import {
  maxDateOfBirthIso,
  MIN_AGE_YEARS,
} from "@/modules/verification/helpers/verification.helper";
import { businessTodayIso } from "@/shared/utils/dates";

/**
 * Customer identity / licence verification schemas (zod v4) — DOMAIN.md
 * "Identity & KYC gates" / ADR-0007.
 *
 * `VerificationService` validates every response against these. Two audiences
 * share the module: the customer sees their own record, a platform admin sees
 * the review queue, and the queue row is DELIBERATELY narrower (no licence
 * number, no date of birth) — triage must not leak identity data.
 *
 * The `z.infer` types live in `../types/verification.types`.
 */

export const customerVerificationStatusSchema = z.enum([
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

/** The four required identity photos (front/back of ID + driver's licence). */
export const customerDocumentTypeSchema = z.enum(CUSTOMER_DOCUMENT_TYPES);

export const customerDocumentWireSchema = z.object({
  id: z.string(),
  type: customerDocumentTypeSchema,
  filename: z.string(),
  contentType: z.string(),
  uploadedAt: z.string(),
});

/** The customer's own record (`GET /verification/me` → `verification`). */
export const customerVerificationWireSchema = z.object({
  status: customerVerificationStatusSchema,
  licenseNumber: z.string().nullable(),
  licenseExpiry: z.string().nullable(),
  /** Null until submitted; the age gate needs it. */
  dateOfBirth: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  licenseExpired: z.boolean(),
  licenseExpiresSoon: z.boolean(),
  daysUntilExpiry: z.number().nullable(),
});

export const customerVerificationWithDocumentsWireSchema = z.object({
  verification: customerVerificationWireSchema,
  documents: z.array(customerDocumentWireSchema),
});

/** Admin triage row — no licence number, no date of birth, on purpose. */
export const customerVerificationQueueRowWireSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  status: customerVerificationStatusSchema,
  licenseExpired: z.boolean(),
  rejectionReason: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  documentCount: z.number(),
  createdAt: z.string(),
});

export const customerVerificationQueueWireSchema = z.array(
  customerVerificationQueueRowWireSchema,
);

/** Admin detail — the full record, once a reviewer opens one row. */
export const customerVerificationAdminWireSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  status: customerVerificationStatusSchema,
  licenseNumber: z.string().nullable(),
  licenseExpiry: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  licenseExpired: z.boolean(),
  rejectionReason: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  documents: z.array(customerDocumentWireSchema),
  documentCount: z.number(),
  createdAt: z.string(),
});

/** `POST /verification` input. Dates are `YYYY-MM-DD`. */
export const submitVerificationInputSchema = z.object({
  licenseNumber: z.string(),
  licenseExpiry: z.string(),
  dateOfBirth: z.string(),
});

/** `PATCH /verification/customers/:userId/reject` input. */
export const rejectVerificationInputSchema = z.object({
  reason: z.string(),
});

// --------------------------------------------------------------- form schemas

/** Backend `SubmitVerificationDto`: licenseNumber 3..60. */
export const LICENSE_NUMBER_MIN = 3;
export const LICENSE_NUMBER_MAX = 60;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shared field rule: an ISO date at least `MIN_AGE_YEARS` ago. The bound is
 * evaluated at PARSE time, not at module load, so a tab left open overnight
 * still validates against today.
 */
export const dateOfBirthField = z
  .string()
  .regex(DATE_ONLY, "Enter your date of birth")
  .refine((v) => v <= maxDateOfBirthIso(), {
    message: `You must be at least ${MIN_AGE_YEARS} years old`,
  });

export const dateOfBirthSchema = z.object({ dateOfBirth: dateOfBirthField });

export const licenseSchema = z.object({
  licenseNumber: z
    .string()
    .trim()
    .min(LICENSE_NUMBER_MIN, "Enter your license number")
    .max(LICENSE_NUMBER_MAX, `At most ${LICENSE_NUMBER_MAX} characters`),
  // Expiry must be today or later in the BUSINESS timezone (matches the
  // server's gate). The server has the final word (and auto-rejects a past
  // date), but we block the obvious case on the same calendar day it uses.
  licenseExpiry: z
    .string()
    .regex(DATE_ONLY, "Enter the expiry date")
    .refine((v) => v >= businessTodayIso(), {
      message:
        "Your license is expired — the expiry date must be today or later",
    }),
  dateOfBirth: dateOfBirthField,
});
