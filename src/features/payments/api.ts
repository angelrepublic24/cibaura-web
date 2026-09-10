import { Api } from "@/shared/api/client";
import type { PaymentMethod } from "@/shared/types/domain";

/**
 * Payment methods API module.
 *
 * INVARIANT #3: card data = gateway tokens only. The card number NEVER
 * touches our frontend or backend — Stripe Elements tokenizes in the
 * browser and we exchange the resulting `pm_…` token for a saved
 * PaymentMethod (brand/last4/exp display data).
 *
 * Backend routes (payments controller — global prefix in the base URL):
 *  - GET    /payments/methods                        -> PaymentMethod[]
 *  - POST   /payments/methods  { gatewayToken }      -> PaymentMethod
 *      (`SavePaymentMethodDto`: the single-use gateway token, 4..255 chars)
 *  - DELETE /payments/methods/:id                    -> 204
 *      (detaches the card at the gateway too)
 *
 * There is NO "set default" route: the backend charges the most recently
 * saved card when a request carries no `paymentMethodId`, and the booking
 * panel always sends the card the customer sees selected.
 */

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
  mine: () => ["payment-methods", "me"] as const,
};

export const PaymentMethodsApi = {
  async findMine(): Promise<PaymentMethod[]> {
    const res = await Api.get<PaymentMethod[]>("/payments/methods");
    return res.data;
  },

  async add(gatewayToken: string): Promise<PaymentMethod> {
    const res = await Api.post<PaymentMethod>("/payments/methods", {
      gatewayToken,
    });
    return res.data;
  },

  async remove(paymentMethodId: string): Promise<void> {
    await Api.delete(`/payments/methods/${paymentMethodId}`);
  },
};
