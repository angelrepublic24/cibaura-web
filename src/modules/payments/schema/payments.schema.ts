import { z } from "zod";

/**
 * Payment-method wire schemas (zod v4).
 *
 * INVARIANT #3: card data = gateway tokens only. Nothing here describes a
 * card NUMBER — the PAN is tokenized inside Stripe's iframe and never
 * reaches our code. What crosses the wire is the saved-card DISPLAY data
 * (brand / last4 / expiry) plus the opaque `pm_…` token on the way in.
 *
 * The `z.infer` types live in `../types/payments.types`.
 */

/** A saved card as the backend returns it. */
export const paymentMethodWireSchema = z.object({
  id: z.string(),
  /** "visa" | "mastercard" | … — free text from the gateway. */
  brand: z.string(),
  last4: z.string(),
  expMonth: z.number(),
  expYear: z.number(),
});

export const paymentMethodListWireSchema = z.array(paymentMethodWireSchema);

/**
 * `POST /payments/methods` input — the single-use gateway token
 * (`SavePaymentMethodDto`: 4..255 chars).
 */
export const savePaymentMethodInputSchema = z.object({
  gatewayToken: z.string().min(4).max(255),
});
