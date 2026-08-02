import { Api } from "@/shared/api/client";
import type { PaymentMethod } from "@/shared/types/domain";

/**
 * Payment methods API module.
 *
 * INVARIANT #3: card data = gateway tokens only. The card number NEVER
 * touches our frontend or backend — the gateway SDK (Stripe Elements /
 * CardNet equivalent) tokenizes in the browser and we exchange the
 * gateway token for a saved PaymentMethod (brand/last4/exp display data).
 *
 * Backend routes (NestJS payments controller — global prefix in the base URL):
 *  - GET    /payments/methods                      -> PaymentMethod[]
 *  - POST   /payments/methods  SavePaymentMethodDto -> PaymentMethod
 *  - DELETE /payments/methods/:id                  -> 204
 *
 * NOTE: the backend `POST /payments/methods` expects the FULL tokenized card
 * metadata (gatewayCustomerId, gatewayPaymentMethodId, brand, last4, expMonth,
 * expYear) — not a bare `gatewayToken` — and there is no "set default" route.
 * `add`/`setDefault` below are placeholders pending the gateway tokenization
 * UI + backend support (see the integration report follow-ups).
 */

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
  mine: () => ["payment-methods", "me"] as const,
};

export const PaymentMethodsApi = {
  async findMine(): Promise<PaymentMethod[]> {
    const res = await Api.get("/payments/methods");
    return res.data;
  },

  async add(gatewayToken: string): Promise<PaymentMethod> {
    const res = await Api.post("/payments/methods", { gatewayToken });
    return res.data;
  },

  async remove(paymentMethodId: string): Promise<void> {
    await Api.delete(`/payments/methods/${paymentMethodId}`);
  },

  async setDefault(paymentMethodId: string): Promise<PaymentMethod> {
    const res = await Api.patch(`/payments/methods/${paymentMethodId}/default`, {});
    return res.data;
  },
};
