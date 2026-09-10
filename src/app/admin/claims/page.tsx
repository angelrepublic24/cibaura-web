"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { claimCurrency } from "@/features/admin/components/order-lifecycle-cards";
import { useAdminClaims } from "@/features/admin/hooks";
import { getErrorMessage } from "@/shared/api/errors";
import { CLAIM_STATUSES, type ClaimAdminDto } from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import {
  ClaimStatusBadge,
  claimStatusLabel,
  DepositStatusBadge,
} from "@/shared/components/claim-deposit-labels";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDateTime } from "@/shared/utils/dates";
import { formatMoneyCents } from "@/shared/utils/money";
import { cn } from "@/lib/utils";

/**
 * /admin/claims — the damage-claim queue (ADR-0013). Defaults to claims
 * awaiting an admin decision (`under_review`: the customer rejected or did
 * not respond); every other status is one tab away. Rows open the detail
 * with the evidence viewer and the decide modal.
 */

const PAGE_SIZE = 20;
type StatusFilter = "" | (typeof CLAIM_STATUSES)[number];
const FILTERS: StatusFilter[] = ["under_review", "open", "", ...CLAIM_STATUSES.filter(
  (s) => s !== "under_review" && s !== "open",
)];

function filterLabel(status: StatusFilter): string {
  return status === "" ? "All" : claimStatusLabel(status);
}

export default function AdminClaimsPage() {
  const [status, setStatus] = useState<StatusFilter>("under_review");
  const [page, setPage] = useState(1);

  const query = { status: status || undefined, page, pageSize: PAGE_SIZE };
  const list = useAdminClaims(query);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Damage claims</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hosts file claims against the security deposit after a return.
            When the customer rejects or does not answer, the claim lands
            here for a decision: approve an amount (captured from the held
            deposit) or reject it.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Claim status"
          className="mt-6 inline-flex flex-wrap overflow-hidden rounded-md border border-border"
        >
          {FILTERS.map((s, i) => (
            <button
              key={s || "all"}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 text-sm transition-colors",
                i > 0 && "border-l border-border",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {filterLabel(s)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {list.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState
              title="Could not load claims"
              message={getErrorMessage(list.error, "Please try again.")}
              onRetry={() => list.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={status ? `No ${filterLabel(status).toLowerCase()} claims` : "No claims"}
              description={
                status === "under_review"
                  ? "Nothing waits for a decision right now."
                  : "Nothing to show for this status."
              }
              className="py-12"
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {total} claim{total === 1 ? "" : "s"}
              </p>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table
                    className={cn(
                      "w-full min-w-[880px] border-collapse text-sm",
                      list.isFetching && "opacity-60 transition-opacity",
                    )}
                  >
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Host</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 text-right font-medium">Requested</th>
                        <th className="px-4 py-3 font-medium">Deposit</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Respond by</th>
                        <th className="px-4 py-3 font-medium">Filed</th>
                        <th className="px-4 py-3 font-medium">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((c) => (
                        <ClaimRow key={c.id} claim={c} />
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
                      disabled={page <= 1 || list.isFetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pageCount || list.isFetching}
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

function ClaimRow({ claim: c }: { claim: ClaimAdminDto }) {
  const currency = claimCurrency(c.deposit);
  return (
    <tr className="align-top transition-colors hover:bg-muted/40">
      <td className="px-4 py-3 font-medium text-foreground">{c.agencyName}</td>
      <td className="px-4 py-3 text-foreground">{c.customerName}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-foreground">
        {formatMoneyCents(c.requestedCents, currency)}
      </td>
      <td className="px-4 py-3">
        {c.deposit ? (
          <div className="space-y-1">
            <DepositStatusBadge status={c.deposit.status} />
            <p className="text-xs text-muted-foreground">
              {formatMoneyCents(c.deposit.amountCents, c.deposit.currency)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No deposit</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ClaimStatusBadge status={c.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatDateTime(c.respondBy)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatDateTime(c.createdAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Link
          href={`/admin/claims/${c.id}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Review
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}
