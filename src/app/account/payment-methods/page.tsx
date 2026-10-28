"use client";

import { useState } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import {
  useMyPaymentMethods,
  useRemovePaymentMethod,
} from "@/modules/payments/hooks/payments.hook";
import { AddCardForm } from "@/modules/payments/components/add-card-form";
import { stripeConfigured } from "@/modules/payments/helpers/payments.helper";
import { getErrorMessage } from "@/shared/api/errors";
import type { PaymentMethod } from "@/shared/types/domain";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Dialog } from "@/shared/components/ui/dialog";

/**
 * /account/payment-methods — saved cards (brand/last4/exp only; PANs
 * never touch this app — invariant #3). "Add card" opens the gateway's
 * tokenization UI in a later iteration.
 */
export default function PaymentMethodsPage() {
  const [showAdd, setShowAdd] = useState(false);
  // The card the user is about to detach — removal is a confirmed,
  // irreversible action (it detaches at the gateway too), so it is gated
  // behind a confirmation dialog like the other destructive account flows.
  const [toRemove, setToRemove] = useState<PaymentMethod | null>(null);

  const query = useMyPaymentMethods();

  // The hook refreshes the list; closing the dialog is this page's business.
  const removeMutation = useRemovePaymentMethod();

  function openRemove(pm: PaymentMethod) {
    removeMutation.reset();
    setToRemove(pm);
  }

  function closeRemove() {
    if (removeMutation.isPending) return;
    setToRemove(null);
    removeMutation.reset();
  }

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
                  onClick={() => openRemove(pm)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={toRemove !== null}
        onClose={closeRemove}
        title="Remove this card?"
        description="This detaches the card from your account at the payment gateway. You can add it again later."
      >
        <div className="space-y-4">
          {toRemove ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
              <p className="font-medium capitalize">
                {toRemove.brand} •••• {toRemove.last4}
              </p>
            </div>
          ) : null}

          {removeMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                removeMutation.error,
                "Could not remove this card. Please try again.",
              )}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeRemove}
              disabled={removeMutation.isPending}
            >
              Keep card
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (toRemove)
                  removeMutation.mutate(toRemove.id, {
                    onSuccess: () => setToRemove(null),
                  });
              }}
            >
              {removeMutation.isPending ? "Removing…" : "Remove card"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
