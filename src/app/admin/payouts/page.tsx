"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Building2, ExternalLink, RefreshCw } from "lucide-react";
import { AdminApi, adminKeys, type AdminPayout } from "@/features/admin/api";
import { PAYOUT_STATUSES, type PayoutStatus } from "@/shared/types/domain";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { RoleGuard } from "@/shared/auth/guard";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { EmptyState, ErrorState } from "@/shared/components/states";
import {
  payoutKindLabel,
  payoutMethodLabel,
  PayoutRailStatusBadge,
  PayoutStatusBadge,
} from "@/shared/components/wallet-labels";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog } from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatMoneyCents } from "@/shared/utils/money";
import { cn } from "@/lib/utils";

/**
 * /admin/payouts — every payout across both rails (ADR-0008 / ADR-0012).
 * Manual bank transfers: agencies request them, an admin wires the money
 * and records the reference ("Pay" — ONE server transaction that debits the
 * wallet and marks the payout paid) or rejects with a reason. Stripe
 * payouts (settlements, check-in advances) are created by the settlement
 * engine and mirrored from Stripe: `railStatus`, the amount the bank
 * received, and the failure reason; a failed one can be retried (a new
 * payout row + debit — the failed one stays as history).
 */

const PAGE_SIZE = 20;

const TAB_LABELS: Record<PayoutStatus, string> = {
  requested: "Requested",
  processing: "Processing",
  paid: "Paid",
  rejected: "Rejected",
  failed: "Failed",
};

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

export default function AdminPayoutsPage() {
  const [status, setStatus] = useState<PayoutStatus>("requested");
  const [page, setPage] = useState(1);

  const query = { status, page, pageSize: PAGE_SIZE };
  const listQuery = useQuery({
    queryKey: adminKeys.payouts(query),
    queryFn: () => AdminApi.listPayouts(query),
    placeholderData: keepPreviousData,
  });

  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wire each requested bank transfer, then record the reference here
            (rejecting releases the amount back to the agency). Stripe payouts
            run automatically — watch their rail status and retry failures.
          </p>
        </div>

        {/* Status tabs */}
        <div
          role="tablist"
          aria-label="Payout status"
          className="mt-6 inline-flex overflow-hidden rounded-md border border-border"
        >
          {PAYOUT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 text-sm transition-colors",
                s !== "requested" && "border-l border-border",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {TAB_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <ErrorState
              title="Could not load payouts"
              message={listQuery.error.message}
              onRetry={() => listQuery.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={`No ${TAB_LABELS[status].toLowerCase()} payouts`}
              description={
                status === "requested"
                  ? "Nothing to wire right now."
                  : "Nothing to show for this status."
              }
              className="py-12"
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {total} payout{total === 1 ? "" : "s"}
              </p>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table
                    className={cn(
                      "w-full min-w-[1180px] border-collapse text-sm",
                      listQuery.isFetching && "opacity-60 transition-opacity",
                    )}
                  >
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Agency</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Method</th>
                        <th className="px-4 py-3 font-medium">Destination</th>
                        <th className="px-4 py-3 font-medium">Requested</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Received</th>
                        <th className="px-4 py-3 font-medium">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((p) => (
                        <PayoutRow key={p.id} payout={p} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {pageCount > 1 ? (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || listQuery.isFetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pageCount || listQuery.isFetching}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

function mapPayoutError(error: unknown): string | undefined {
  if (isApiErrorCode(error, API_ERROR_CODES.PAYOUT_NOT_PENDING)) {
    return "This payout was already decided — refresh the queue.";
  }
  if (isApiErrorCode(error, API_ERROR_CODES.INSUFFICIENT_BALANCE)) {
    return "The agency's wallet no longer covers this amount. Reject it and let them request again.";
  }
  if (isApiErrorCode(error, API_ERROR_CODES.PAYOUT_ACCOUNT_NOT_ACTIVE)) {
    return "The agency's Stripe payout account is not active — the money stays in their wallet.";
  }
  if (isApiErrorCode(error, API_ERROR_CODES.PAYOUT_RAIL_DISABLED)) {
    return "Stripe payouts are switched off in Settings.";
  }
  return undefined;
}

function PayoutRow({ payout: p }: { payout: AdminPayout }) {
  const qc = useQueryClient();
  const [action, setAction] = useState<null | "pay" | "reject" | "retry">(null);
  const stripe = p.method === "stripe_connect";
  const pending = p.status === "requested" && !stripe;
  const retryable = p.status === "failed" && stripe;

  function invalidate() {
    qc.invalidateQueries({ queryKey: adminKeys.payouts() });
    qc.invalidateQueries({ queryKey: adminKeys.overview() });
  }


  return (
    <tr className="align-top transition-colors hover:bg-muted/40">
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{p.agencyName}</p>
            <Link
              href={`/agencies/${p.agencySlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              /{p.agencySlug}
              <ExternalLink className="h-3 w-3" />
            </Link>
            {p.requestedByName ? (
              <p className="text-xs text-muted-foreground">
                by {p.requestedByName}
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-foreground">
        {formatMoneyCents(p.amountCents, p.currency)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <p className="text-foreground">{payoutMethodLabel(p.method)}</p>
        <p>{payoutKindLabel(p.kind)}</p>
        {p.bookingId ? (
          <Link
            href={`/admin/orders/${p.bookingId}`}
            className="text-primary hover:underline"
          >
            View order
          </Link>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {stripe ? (
          <span>Stripe payout account</span>
        ) : p.bankDetails ? (
          <div className="space-y-0.5">
            <p className="text-foreground">{p.bankDetails.bankName}</p>
            <p>{p.bankDetails.accountHolder}</p>
            <p className="font-mono">
              {p.bankDetails.accountNumber} · {p.bankDetails.accountType} ·{" "}
              {p.bankDetails.currency}
            </p>
          </div>
        ) : (
          <span className="text-destructive">No bank account on file</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {fmtDateTime(p.requestedAt)}
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <PayoutStatusBadge status={p.status} />
          {p.railStatus ? <PayoutRailStatusBadge status={p.railStatus} /> : null}
          {p.status === "paid" && p.reference ? (
            <p className="font-mono text-xs text-foreground">{p.reference}</p>
          ) : null}
          {p.status === "rejected" && p.note ? (
            <p className="max-w-56 text-xs text-destructive">{p.note}</p>
          ) : null}
          {p.status === "failed" ? (
            <p className="max-w-56 text-xs text-destructive">
              {p.failureReason ?? "Failed — the amount was returned to the wallet."}
            </p>
          ) : null}
          {p.decidedAt ? (
            <p className="text-xs text-muted-foreground">
              {fmtDateTime(p.decidedAt)}
              {p.decidedByName ? ` · ${p.decidedByName}` : ""}
            </p>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
        {p.receivedAmount
          ? formatMoneyCents(p.receivedAmount.value, p.receivedAmount.currency)
          : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {pending ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setAction("pay")}>
              Pay
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAction("reject")}
            >
              Reject
            </Button>
          </div>
        ) : retryable ? (
          <Button size="sm" variant="outline" onClick={() => setAction("retry")}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        ) : null}

        <RetryDialog
          open={action === "retry"}
          onClose={() => setAction(null)}
          payout={p}
          onDone={invalidate}
        />

        <ReasonDialog
          open={action === "pay"}
          onClose={() => setAction(null)}
          title={`Mark ${formatMoneyCents(p.amountCents, p.currency)} as paid?`}
          description={`Confirms you wired the money to ${p.agencyName}. The amount leaves their wallet now.`}
          field={{
            label: "Bank transfer reference",
            placeholder: "e.g. TRX-2026-000123",
            hint: "Shown to the agency on their payout history.",
            minLength: 2,
            maxLength: 120,
            singleLine: true,
          }}
          confirmLabel="Mark as paid"
          onConfirm={async (value) => {
            await AdminApi.payPayout(p.id, value ?? "");
            invalidate();
          }}
          mapError={mapPayoutError}
        />
        <ReasonDialog
          open={action === "reject"}
          onClose={() => setAction(null)}
          title="Reject this payout?"
          description={`${formatMoneyCents(p.amountCents, p.currency)} goes back to ${p.agencyName}'s available balance.`}
          field={{
            label: "Reason",
            placeholder: "e.g. Bank account details do not match the agency's legal name",
            hint: "Shown to the agency.",
            minLength: 2,
            maxLength: 300,
          }}
          confirmLabel="Reject payout"
          destructive
          onConfirm={async (value) => {
            await AdminApi.rejectPayout(p.id, value ?? "");
            invalidate();
          }}
          mapError={mapPayoutError}
        />
      </td>
    </tr>
  );
}

/** Confirmation for re-submitting a failed Stripe payout (no extra input). */
function RetryDialog({
  open,
  onClose,
  payout: p,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  payout: AdminPayout;
  onDone: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => AdminApi.retryPayout(p.id),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  const { reset } = mutation;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);
  const busy = mutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={`Retry ${formatMoneyCents(p.amountCents, p.currency)} to ${p.agencyName}?`}
      description="A new Stripe payout is created and the amount leaves the agency's wallet again. This failed payout stays in the history."
    >
      {mutation.isError ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {mapPayoutError(mutation.error) ??
            getErrorMessage(mutation.error, "Could not retry the payout.")}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Keep as is
        </Button>
        <Button type="button" disabled={busy} onClick={() => mutation.mutate()}>
          {busy ? "Submitting…" : "Retry payout"}
        </Button>
      </div>
    </Dialog>
  );
}
