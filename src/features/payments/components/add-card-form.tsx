"use client";

import { useState } from "react";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getStripe } from "@/features/payments/stripe";
import { PaymentMethodsApi, paymentMethodKeys } from "@/features/payments/api";
import { Button } from "@/shared/components/ui/button";

const stripePromise = getStripe();

/**
 * Add-card form backed by Stripe Elements. The PAN is entered inside Stripe's
 * iframe and tokenized in the browser (`stripe.createPaymentMethod`) — our code
 * only ever sees the resulting `pm_...` id, which we exchange for a saved card
 * (brand/last4/exp) on the backend. No card number ever reaches our servers.
 */
function CardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const qc = useQueryClient();
  const [cardError, setCardError] = useState<string | null>(null);
  const [tokenizing, setTokenizing] = useState(false);

  const save = useMutation({
    mutationFn: (token: string) => PaymentMethodsApi.add(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentMethodKeys.mine() });
      onDone();
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCardError(null);
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setTokenizing(true);
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: "card",
      card,
    });
    setTokenizing(false);

    if (error) {
      setCardError(error.message ?? "We couldn't read that card.");
      return;
    }
    save.mutate(paymentMethod.id);
  }

  const busy = tokenizing || save.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4 shadow-sm"
    >
      <div className="rounded-[var(--radius-sm)] border border-border bg-background px-3 py-3">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#14181f",
                "::placeholder": { color: "#9a938a" },
              },
              invalid: { color: "#dc2626" },
            },
          }}
        />
      </div>

      {cardError ? (
        <p className="text-sm text-destructive">{cardError}</p>
      ) : null}
      {save.isError ? (
        <p className="text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!stripe || busy}>
          {busy ? "Saving…" : "Save card"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Test mode — use <span className="font-medium">4242 4242 4242 4242</span>,
        any future expiry, any CVC.
      </p>
    </form>
  );
}

export function AddCardForm({ onDone }: { onDone: () => void }) {
  return (
    <Elements stripe={stripePromise}>
      <CardForm onDone={onDone} />
    </Elements>
  );
}
