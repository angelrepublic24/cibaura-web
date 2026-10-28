import type { z } from "zod";
import type { cancelBookingSchema, disputeInspectionSchema, quoteInputSchema, requestBookingInputSchema, respondClaimInputSchema, respondClaimSchema, retryDepositSchema, signRentalAgreementSchema, signatureInputSchema } from "@/modules/bookings/schema/bookings.schema";

/**
 * Booking types — every one is the `z.infer` of a schema in `../schema`.
 * The wire shapes are structurally the shared `Booking` / `BookingDetail` /
 * `Quote` / … that the service returns; its return annotations enforce it.
 */

// -------------------------------------------------------------- service input

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type SignatureInput = z.infer<typeof signatureInputSchema>;
export type RequestBookingInput = z.infer<typeof requestBookingInputSchema>;
export type RespondClaimInput = z.infer<typeof respondClaimInputSchema>;

// --------------------------------------------------------------- form values

export type CancelBookingFormValues = z.infer<typeof cancelBookingSchema>;
export type SignRentalAgreementFormValues = z.infer<
  typeof signRentalAgreementSchema
>;
export type DisputeInspectionFormValues = z.infer<
  typeof disputeInspectionSchema
>;
export type RespondClaimFormValues = z.infer<typeof respondClaimSchema>;
export type RetryDepositFormValues = z.infer<typeof retryDepositSchema>;
