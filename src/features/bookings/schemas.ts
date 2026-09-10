import { z } from "zod";

/** Backend `CancelBookingDto` / `RejectBookingDto`: reason 2..160 characters. */
export const BOOKING_REASON_MIN = 2;
export const BOOKING_REASON_MAX = 160;

/** `POST /bookings/:id/cancel { reason }` — the reason is shown to the agency. */
export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Tell the agency why you are cancelling (at least 3 characters)")
    .max(
      BOOKING_REASON_MAX,
      `Keep the reason to ${BOOKING_REASON_MAX} characters or fewer`,
    ),
});
export type CancelBookingFormValues = z.infer<typeof cancelBookingSchema>;

/** Backend `SignatureDto`: typedName 2..160 (spec §4.B7). */
export const TYPED_NAME_MIN = 2;
export const TYPED_NAME_MAX = 160;

/**
 * "Review and sign the rental agreement" step of the request flow: the
 * typed full name IS the electronic signature; the checkbox is the explicit
 * consent (the server answers 400 SIGNATURE_REQUIRED without either).
 */
export const signRentalAgreementSchema = z.object({
  typedName: z
    .string()
    .trim()
    .min(TYPED_NAME_MIN, "Type your full legal name to sign")
    .max(TYPED_NAME_MAX, `At most ${TYPED_NAME_MAX} characters`),
  acceptAgreement: z.boolean().refine((v) => v === true, {
    message: "Tick the box to confirm you have read and agree to the agreement",
  }),
});
export type SignRentalAgreementFormValues = z.infer<
  typeof signRentalAgreementSchema
>;

/** `POST /bookings/:id/inspections/:inspectionId/dispute { note }`: 2..1000. */
export const INSPECTION_DISPUTE_NOTE_MIN = 2;
export const INSPECTION_DISPUTE_NOTE_MAX = 1000;

export const disputeInspectionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(
      INSPECTION_DISPUTE_NOTE_MIN,
      "Describe what you disagree with (at least 2 characters)",
    )
    .max(
      INSPECTION_DISPUTE_NOTE_MAX,
      `Keep the note to ${INSPECTION_DISPUTE_NOTE_MAX} characters or fewer`,
    ),
});
export type DisputeInspectionFormValues = z.infer<
  typeof disputeInspectionSchema
>;

/** `POST /bookings/:id/claims/:claimId/respond { accept, note? }`: note ≤1000. */
export const CLAIM_NOTE_MAX = 1000;

export const respondClaimSchema = z.object({
  response: z.enum(["accept", "reject"], {
    error: "Choose whether you accept or reject the claim",
  }),
  note: z
    .string()
    .trim()
    .max(CLAIM_NOTE_MAX, `Keep the note to ${CLAIM_NOTE_MAX} characters or fewer`),
});
export type RespondClaimFormValues = z.infer<typeof respondClaimSchema>;

/** `POST /bookings/:id/deposit/retry { paymentMethodId }` — a saved card id. */
export const retryDepositSchema = z.object({
  paymentMethodId: z.string().min(1, "Choose the card for the deposit hold"),
});
export type RetryDepositFormValues = z.infer<typeof retryDepositSchema>;
