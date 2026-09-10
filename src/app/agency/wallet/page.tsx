"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { PermissionGate } from "@/features/agency/components/permission-gate";
import { StripePayoutsCard } from "@/features/agency/components/stripe-payouts-card";
import { usePermission } from "@/features/agency/use-permission";
import type {
  AgencyWallet,
  LedgerEntry,
  Payout,
} from "@/shared/types/domain";
import { API_ERROR_CODES, getErrorMessage, isApiErrorCode } from "@/shared/api/errors";
import { formatMoneyCents, wholeUnitsToCents } from "@/shared/utils/money";
import {
  ledgerKindLabel,
  payoutKindLabel,
  payoutMethodLabel,
  PayoutRailStatusBadge,
  PayoutStatusBadge,
} from "@/shared/components/wallet-labels";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * /agency/wallet — balance, payouts and the append-only ledger (`wallet:view`).
 *
 * Money flow: a settled booking credits the agency (subtotal − adjustments);
 * a manual payout request reserves part of the balance (`pendingPayoutCents`)
 * until an admin pays it (a `payout` DEBIT) or rejects it (reservation
 * released). With an ACTIVE Stripe payout account (ADR-0012) settlements are
 * paid out automatically instead (`method = stripe_connect`, tracked through
 * `railStatus`; a failure reverses the debit). Refunds after settlement,
 * cancellation retentions, claims and payout reversals land as their own
 * ledger kinds. Every figure is server-computed; this screen only formats
 * and, for the payout form, converts the typed amount to cents at the input
 * boundary.
 */
export default function AgencyWalletPage() {
  return (
    <PermissionGate permission="wallet:view">
      <WalletBody />
    </PermissionGate>
  );
}

function WalletBody() {
  const { can } = usePermission();
  const walletQuery = useQuery({
    queryKey: agencyKeys.wallet(),
    queryFn: AgencyApi.wallet,
  });
  const payoutsQuery = useQuery({
    queryKey: agencyKeys.payouts(),
    queryFn: AgencyApi.payouts,
  });

  if (walletQuery.isLoading) return <LoadingState label="Loading wallet…" />;
  if (walletQuery.isError) {
    return (
      <ErrorState
        title="Could not load your wallet"
        message={walletQuery.error.message}
        onRetry={() => walletQuery.refetch()}
      />
    );
  }

  const wallet = walletQuery.data!;
  const currency = wallet.account.currency;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-foreground">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earnings from settled bookings, payouts to your bank, and every
          movement in between.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Balance" value={formatMoneyCents(wallet.account.balanceCents, currency)} />
        <Tile
          label="Pending payouts"
          value={formatMoneyCents(wallet.pendingPayoutCents, currency)}
          hint="Requested, not yet paid"
        />
        <Tile
          label="Available"
          value={formatMoneyCents(wallet.availableCents, currency)}
          hint="Balance minus pending payouts"
          emphasis
        />
      </div>

      {/* Reads `useSearchParams` (Stripe return) — needs a Suspense boundary. */}
      <Suspense fallback={<LoadingState label="Loading Stripe payout status…" />}>
        <StripePayoutsCard />
      </Suspense>

      {can("wallet:withdraw") ? <RequestPayoutCard wallet={wallet} /> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payouts</h2>
        {payoutsQuery.isLoading ? (
          <LoadingState label="Loading payouts…" className="py-6" />
        ) : payoutsQuery.isError ? (
          <ErrorState
            title="Could not load payouts"
            message={payoutsQuery.error.message}
            onRetry={() => payoutsQuery.refetch()}
          />
        ) : payoutsQuery.data!.length === 0 ? (
          <EmptyState
            title="No payouts yet"
            description="Request a payout above once you have an available balance, or set up Stripe payouts to receive settlements automatically."
            className="py-10"
          />
        ) : (
          <PayoutsTable payouts={payoutsQuery.data!} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ledger</h2>
        {wallet.entries.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Earnings from settled bookings will appear here."
            className="py-10"
          />
        ) : (
          <LedgerList entries={wallet.entries} currency={currency} />
        )}
      </section>
    </div>
  );
}

// ── tiles ────────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span
          className={cn(
            "text-3xl font-bold tabular-nums tracking-tight",
            emphasis ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </span>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── request payout ───────────────────────────────────────────────────────────

/** Backend `RequestPayoutDto`: `@Min(1000)` cents. */
const MIN_PAYOUT_CENTS = 1000;

interface PayoutFormValues {
  amount: string;
}

function payoutSchema(availableCents: number, currency: string) {
  return z.object({
    amount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount, e.g. 150 or 150.50")
      .refine(
        (v) => wholeUnitsToCents(Number(v)) >= MIN_PAYOUT_CENTS,
        `Minimum payout is ${formatMoneyCents(MIN_PAYOUT_CENTS, currency)}`,
      )
      .refine(
        (v) => wholeUnitsToCents(Number(v)) <= availableCents,
        `You can request up to ${formatMoneyCents(availableCents, currency)}`,
      ),
  });
}

function RequestPayoutCard({ wallet }: { wallet: AgencyWallet }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<Payout | null>(null);
  const currency = wallet.account.currency;
  const available = wallet.availableCents;

  const schema = useMemo(
    () => payoutSchema(available, currency),
    [available, currency],
  );
  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: PayoutFormValues) =>
      AgencyApi.requestPayout(wholeUnitsToCents(Number(values.amount))),
    onSuccess: (payout) => {
      setDone(payout);
      form.reset({ amount: "" });
      // Available balance drops by the reservation; the payouts list grows.
      qc.invalidateQueries({ queryKey: agencyKeys.wallet() });
      qc.invalidateQueries({ queryKey: agencyKeys.payouts() });
    },
    onError: () => {
      // A server-side "not enough" means our snapshot is stale — refresh it.
      qc.invalidateQueries({ queryKey: agencyKeys.wallet() });
    },
  });

  const canRequest = available >= MIN_PAYOUT_CENTS;
  const error = mutation.error;
  const bankMissing = isApiErrorCode(
    error,
    API_ERROR_CODES.PAYOUT_BANK_DETAILS_MISSING,
  );
  const insufficient = isApiErrorCode(error, API_ERROR_CODES.INSUFFICIENT_BALANCE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Request a payout</CardTitle>
        <CardDescription>
          We transfer to the bank account in your settings. Manual payouts are
          processed by our team, usually within a few business days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => {
            setDone(null);
            mutation.mutate(values);
          })}
          className="flex flex-wrap items-start gap-3"
        >
          <div className="w-48 space-y-1.5">
            <Label htmlFor="po-amount">Amount ({currency})</Label>
            <Input
              id="po-amount"
              inputMode="decimal"
              placeholder="150.00"
              disabled={!canRequest || mutation.isPending}
              aria-invalid={!!form.formState.errors.amount}
              {...form.register("amount")}
            />
          </div>
          <Button
            type="submit"
            className="sm:mt-6"
            disabled={!canRequest || mutation.isPending}
          >
            {mutation.isPending ? "Requesting…" : "Request payout"}
          </Button>
        </form>

        {form.formState.errors.amount ? (
          <p className="mt-2 text-sm text-destructive">
            {form.formState.errors.amount.message}
          </p>
        ) : !canRequest ? (
          <p className="mt-2 text-xs text-muted-foreground">
            You need at least {formatMoneyCents(MIN_PAYOUT_CENTS, currency)}{" "}
            available to request a payout.
          </p>
        ) : null}

        {mutation.isError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {bankMissing ? (
              <>
                Add a payout bank account in{" "}
                <Link href="/agency/settings" className="underline">
                  Settings
                </Link>{" "}
                before requesting a payout.
              </>
            ) : insufficient ? (
              "That amount exceeds your available balance — the figures above have been refreshed."
            ) : (
              getErrorMessage(error, "Could not request the payout.")
            )}
          </p>
        ) : null}
        {done ? (
          <p className="mt-2 text-sm text-success" role="status">
            Payout of {formatMoneyCents(done.amountCents, done.currency)}{" "}
            requested. You will be notified when it is paid.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── payouts table ────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The one line of context a payout row carries: reference, reason or failure. */
function payoutNote(p: Payout): React.ReactNode {
  if (p.status === "paid" && p.reference) {
    return <span className="font-mono text-xs text-foreground">{p.reference}</span>;
  }
  if (p.status === "rejected" && p.note) {
    return <span className="text-destructive">{p.note}</span>;
  }
  if (p.status === "failed") {
    return (
      <span className="text-destructive">
        {p.failureReason ?? "Failed — the amount was returned to your balance."}
      </span>
    );
  }
  return "—";
}

function PayoutsTable({ payouts }: { payouts: Payout[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Requested</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Reference / reason</th>
              <th className="px-4 py-3 font-medium">Decided</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payouts.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {fmtDateTime(p.requestedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                  {formatMoneyCents(p.amountCents, p.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {payoutMethodLabel(p.method)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="space-y-0.5">
                    <p>{payoutKindLabel(p.kind)}</p>
                    {p.bookingId ? (
                      <Link
                        href={`/agency/requests/${p.bookingId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View booking
                      </Link>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <PayoutStatusBadge status={p.status} />
                    {p.railStatus ? (
                      <PayoutRailStatusBadge status={p.railStatus} />
                    ) : null}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {p.receivedAmount
                    ? formatMoneyCents(
                        p.receivedAmount.value,
                        p.receivedAmount.currency,
                      )
                    : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{payoutNote(p)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {fmtDateTime(p.decidedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── ledger ───────────────────────────────────────────────────────────────────

function LedgerList({
  entries,
  currency,
}: {
  entries: LedgerEntry[];
  currency: string;
}) {
  return (
    <div className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
      {entries.map((e) => {
        const credit = e.amountCents >= 0;
        return (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 p-3 text-sm"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {ledgerKindLabel(e.kind)}
                </span>
                {e.bookingId ? (
                  <Link
                    href={`/agency/requests/${e.bookingId}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View booking
                  </Link>
                ) : null}
              </div>
              <p className="mt-1 truncate font-medium text-foreground">
                {e.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDateTime(e.createdAt)}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                credit ? "text-success" : "text-destructive",
              )}
            >
              {credit ? "+" : "−"}
              {formatMoneyCents(Math.abs(e.amountCents), currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
