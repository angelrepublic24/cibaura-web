import type { z } from "zod";
import type {
  paymentMethodWireSchema,
  savePaymentMethodInputSchema,
} from "@/modules/payments/schema/payments.schema";

/**
 * Payment types — every one is the `z.infer` of a schema in `../schema`.
 * `PaymentMethodWire` is structurally the shared `PaymentMethod`, which is
 * what the service returns; the service's return annotation is what keeps
 * the two from drifting.
 */
export type PaymentMethodWire = z.infer<typeof paymentMethodWireSchema>;
export type SavePaymentMethodInput = z.infer<
  typeof savePaymentMethodInputSchema
>;
