import { Api } from "@/shared/api/client";
import type { PaymentMethod } from "@/shared/types/domain";
import {
  paymentMethodListWireSchema,
  paymentMethodWireSchema,
  savePaymentMethodInputSchema,
} from "@/modules/payments/schema/payments.schema";

/**
 * Payment-methods API client — the ONLY thing in the module that talks to
 * the backend. Hooks call these, components call hooks.
 *
 * INVARIANT #3: card data = gateway tokens only. The card number NEVER
 * touches our frontend or backend — Stripe Elements tokenizes in the browser
 * and we exchange the resulting `pm_…` token for a saved PaymentMethod
 * (brand/last4/exp display data).
 *
 * Backend routes:
 *  - GET    /payments/methods                   -> PaymentMethod[]
 *  - POST   /payments/methods { gatewayToken }  -> PaymentMethod
 *  - DELETE /payments/methods/:id               -> 204 (detaches at the gateway)
 *
 * There is NO "set default" route: the backend charges the most recently
 * saved card when a request carries no `paymentMethodId`, and the booking
 * panel always sends the card the customer sees selected.
 */
class PaymentsService {
  async findMine(): Promise<PaymentMethod[]> {
    const res = await Api.get<unknown>("/payments/methods");
    return paymentMethodListWireSchema.parse(res.data);
  }

  /** The token is validated on the way OUT too: a 4..255 char `pm_…`. */
  async add(gatewayToken: string): Promise<PaymentMethod> {
    const body = savePaymentMethodInputSchema.parse({ gatewayToken });
    const res = await Api.post<unknown>("/payments/methods", body);
    return paymentMethodWireSchema.parse(res.data);
  }

  async remove(paymentMethodId: string): Promise<void> {
    await Api.delete(
      `/payments/methods/${encodeURIComponent(paymentMethodId)}`,
    );
  }
}

export const paymentsService = new PaymentsService();
