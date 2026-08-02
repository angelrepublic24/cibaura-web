"use client";

import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * /agency/wallet — balance + append-only ledger. On a settled booking the
 * agency is credited (total − commission) and the platform is credited the
 * commission; every movement is a signed ledger entry (credit > 0, debit < 0).
 * Payouts are a later phase — this is a read-only statement for now.
 */
export default function AgencyWalletPage() {
  const query = useQuery({
    queryKey: agencyKeys.wallet(),
    queryFn: AgencyApi.wallet,
  });

  if (query.isLoading) return <LoadingState label="Loading wallet…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load your wallet"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const { account, entries } = query.data!;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Available balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold">
            {formatMoneyCents(account.balanceCents, account.currency)}
          </span>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        {entries.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Earnings from settled bookings will appear here."
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    e.amountCents >= 0 ? "text-emerald-700" : "text-red-600",
                  )}
                >
                  {e.amountCents >= 0 ? "+" : "−"}
                  {formatMoneyCents(
                    Math.abs(e.amountCents),
                    account.currency,
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
