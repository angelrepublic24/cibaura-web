import type { z } from "zod";
import type {
  customerDocumentWireSchema,
  customerVerificationAdminWireSchema,
  customerVerificationQueueRowWireSchema,
  customerVerificationWireSchema,
  customerVerificationWithDocumentsWireSchema,
  dateOfBirthSchema,
  licenseSchema,
  rejectVerificationInputSchema,
  submitVerificationInputSchema,
} from "@/modules/verification/schema/verification.schema";

/**
 * Verification types — every one is the `z.infer` of a schema in `../schema`.
 * They are structurally the shared `Customer*` interfaces the service
 * returns; the service's return annotations enforce that.
 */
export type CustomerDocumentWire = z.infer<typeof customerDocumentWireSchema>;
export type CustomerVerificationWire = z.infer<
  typeof customerVerificationWireSchema
>;
export type CustomerVerificationWithDocumentsWire = z.infer<
  typeof customerVerificationWithDocumentsWireSchema
>;
export type CustomerVerificationQueueRowWire = z.infer<
  typeof customerVerificationQueueRowWireSchema
>;
export type CustomerVerificationAdminWire = z.infer<
  typeof customerVerificationAdminWireSchema
>;

export type SubmitVerificationInput = z.infer<
  typeof submitVerificationInputSchema
>;
export type RejectVerificationInput = z.infer<
  typeof rejectVerificationInputSchema
>;

// --------------------------------------------------------------- form values

export type DateOfBirthFormValues = z.infer<typeof dateOfBirthSchema>;
export type LicenseFormValues = z.infer<typeof licenseSchema>;
