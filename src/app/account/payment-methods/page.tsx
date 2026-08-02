"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Trash2 } from "lucide-react";
import {
  PaymentMethodsApi,
  paymentMethodKeys,
} from "@/features/payments/api";
import { AddCardForm } from "@/features/payments/components/add-card-form";
import { stripeConfigured } from "@/features/payments/stripe";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

/**
 * /account/payment-methods — saved cards (brand/last4/exp only; PANs
 * never touch this app — invariant #3). "Add card" opens the gateway's
 * tokenization UI in a later iteration.
 */
export default function PaymentMethodsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const query = useQuery({
    queryKey: paymentMethodKeys.mine(),
    queryFn: PaymentMethodsApi.findMine,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => PaymentMethodsApi.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: paymentMethodKeys.mine() }),
  });

  if (query.isLoading) return <LoadingState label="Loading cards…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load payment methods"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const methods = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved cards</h2>
        {stripeConfigured ? (
          <Button
            variant={showAdd ? "outline" : "default"}
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? "Close" : "Add card"}
          </Button>
        ) : (
          <Button
            disabled
            title="Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card entry"
          >
            Add card
          </Button>
        )}
      </div>

      {showAdd ? <AddCardForm onDone={() => setShowAdd(false)} /> : null}

      {methods.length === 0 ? (
        <EmptyState
          title="No saved cards"
          description="Cards are tokenized by the payment gateway — we only ever store the brand and last 4 digits."
        />
      ) : (
        <div className="space-y-3">
          {methods.map((pm) => (
            <Card key={pm.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="font-medium capitalize">
                      {pm.brand} •••• {pm.last4}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expires {String(pm.expMonth).padStart(2, "0")}/{pm.expYear}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove card"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(pm.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
