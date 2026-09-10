"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink } from "lucide-react";
import { AdminApi, adminKeys, type AdminPayout } from "@/features/admin/api";
import { PAYOUT_STATUSES, type PayoutStatus } from "@/shared/types/domain";
import { API_ERROR_CODES, isApiErrorCode } from "@/shared/api/errors";
import { RoleGuard } from "@/shared/auth/guard";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { PayoutStatusBadge } from "@/shared/components/wallet-labels";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatMoneyCents } from "@/shared/utils/money";
import { cn } from "@/lib/utils";

/**
 * /admin/payouts — the manual payout queue. Agencies request transfers from
 * their wallet; an admin wires the money at the bank, then records the
 * transfer reference here ("Pay" — ONE server transaction that debits the
 * agency wallet and marks the payout paid) or rejects with a reason (the
 * reservation is released back to the agency's available balance).
 */

const PAGE_SIZE = 20;

const TAB_LABELS: Record<PayoutStatus, string> = {
  requested: "Requested",
  paid: "Paid",
  rejected: "Rejected",
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
            Wire each requested payout at the bank, then record the transfer
            reference here. Rejecting releases the amount back to the agency.
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
                      "w-full min-w-[880px] border-collapse text-sm",
                      listQuery.isFetching && "opacity-60 transition-opacity",
                    )}
                  >
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Agency</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Bank account</th>
                        <th className="px-4 py-3 font-medium">Requested</th>
                        <th className="px-4 py-3 font-medium">Status</th>
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

function PayoutRow({ payout: p }: { payout: AdminPayout }) {
  const qc = useQueryClient();
  const [action, setAction] = useState<null | "pay" | "reject">(null);
  const pending = p.status === "requested";

  function invalidate() {
    qc.invalidateQueries({ queryKey: adminKeys.payouts() });
    qc.invalidateQueries({ queryKey: adminKeys.overview() });
  }

  const mapError = (error: unknown) => {
    if (isApiErrorCode(error, API_ERROR_CODES.PAYOUT_NOT_PENDING)) {
      return "This payout was already decided — refresh the queue.";
    }
    if (isApiErrorCode(error, API_ERROR_CODES.INSUFFICIENT_BALANCE)) {
      return "The agency's wallet no longer covers this amount. Reject it and let them request again.";
    }
    return undefined;
  };

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
        {p.bankDetails ? (
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
          {p.status === "paid" && p.reference ? (
            <p className="font-mono text-xs text-foreground">{p.reference}</p>
          ) : null}
          {p.status === "rejected" && p.note ? (
            <p className="max-w-56 text-xs text-destructive">{p.note}</p>
          ) : null}
          {p.decidedAt ? (
            <p className="text-xs text-muted-foreground">
              {fmtDateTime(p.decidedAt)}
              {p.decidedByName ? ` · ${p.decidedByName}` : ""}
            </p>
          ) : null}
        </div>
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
        ) : null}

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
          mapError={mapError}
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
          mapError={mapError}
        />
      </td>
    </tr>
  );
}
