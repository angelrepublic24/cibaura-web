import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentsService } from "@/modules/payments/services/payments.service";

/** Query keys for the payments module (the only cache it owns). */
export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
  mine: () => ["payment-methods", "me"] as const,
};

/**
 * The caller's saved cards, newest first. `enabled` exists because two of
 * the three call sites read this on a public page where the visitor may be
 * a guest, and the endpoint is session-scoped.
 */
export function useMyPaymentMethods(enabled = true) {
  return useQuery({
    queryKey: paymentMethodKeys.mine(),
    queryFn: () => paymentsService.findMine(),
    enabled,
  });
}

/**
 * Exchange a gateway token for a saved card. Both mutations refresh the
 * card list themselves — every surface that adds or removes a card also
 * renders one.
 */
export function useAddPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gatewayToken: string) => paymentsService.add(gatewayToken),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: paymentMethodKeys.mine() }),
  });
}

export function useRemovePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentMethodId: string) =>
      paymentsService.remove(paymentMethodId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: paymentMethodKeys.mine() }),
  });
}
