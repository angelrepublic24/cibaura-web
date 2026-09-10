"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { AdminApi, adminKeys } from "@/features/admin/api";
import { useAdminPayoutAccounts } from "@/features/admin/hooks";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import {
  PAYOUT_ACCOUNT_STATUSES,
  type PayoutAccountAdminDto,
  type PayoutAccountStatus,
} from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { PayoutAccountStatusBadge } from "@/shared/components/wallet-labels";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog } from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDateTime } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

/**
 * /admin/payout-accounts — Stripe payout recipients per agency (ADR-0012):
 * onboarding status mirrored from Stripe, the attached bank account, the
 * requirements still due, and the platform-side switch to disable (with a
 * reason) or re-enable automatic payouts for one host.
 */

const PAGE_SIZE = 20;
type StatusFilter = "" | PayoutAccountStatus;
const FILTERS: StatusFilter[] = ["", ...PAYOUT_ACCOUNT_STATUSES];

const FILTER_LABELS: Record<PayoutAccountStatus, string> = {
  not_started: "Not set up",
  onboarding: "Onboarding",
  restricted: "Restricted",
  active: "Active",
  disabled: "Disabled",
};

export default function AdminPayoutAccountsPage() {
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);

  const query = { status: status || undefined, page, pageSize: PAGE_SIZE };
  const list = useAdminPayoutAccounts(query);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Payout accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stripe recipients of every host. Settlements are paid out
            automatically only while an account is active; disabling one
            keeps the host&apos;s money in the wallet for manual transfers.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Account status"
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
              {s ? FILTER_LABELS[s] : "All"}
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
              title="Could not load payout accounts"
              message={getErrorMessage(list.error, "Please try again.")}
              onRetry={() => list.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payout accounts"
              description={
                status
                  ? "No account is in this status."
                  : "No host has started the Stripe payout setup yet."
              }
              className="py-12"
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {total} account{total === 1 ? "" : "s"}
              </p>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table
                    className={cn(
                      "w-full min-w-[960px] border-collapse text-sm",
                      list.isFetching && "opacity-60 transition-opacity",
                    )}
                  >
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Agency</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Bank account</th>
                        <th className="px-4 py-3 font-medium">Requirements due</th>
                        <th className="px-4 py-3 font-medium">Stripe account</th>
                        <th className="px-4 py-3 font-medium">Last synced</th>
                        <th className="px-4 py-3 font-medium">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((a) => (
                        <AccountRow key={a.agencyId} account={a} />
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

function mapAccountError(error: unknown): string | undefined {
  if (isApiErrorCode(error, API_ERROR_CODES.PAYOUT_RAIL_DISABLED)) {
    return "Stripe payouts are switched off in Settings — enable them first.";
  }
  return undefined;
}

function AccountRow({ account: a }: { account: PayoutAccountAdminDto }) {
  const qc = useQueryClient();
  const [action, setAction] = useState<null | "disable" | "enable">(null);
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: adminKeys.payoutAccounts() });

  return (
    <tr className="align-top transition-colors hover:bg-muted/40">
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{a.agencyName}</p>
            <p className="text-xs text-muted-foreground">{a.rail}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <PayoutAccountStatusBadge status={a.status} />
          {a.status === "disabled" && a.disabledReason ? (
            <p className="max-w-56 text-xs text-destructive">{a.disabledReason}</p>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {a.payoutMethod ? (
          <div className="space-y-0.5">
            <p className="text-foreground">{a.payoutMethod.bankName ?? "Bank account"}</p>
            <p className="font-mono">
              {a.payoutMethod.last4 ? `•••• ${a.payoutMethod.last4}` : "—"} ·{" "}
              {a.payoutMethod.currency.toUpperCase()}
            </p>
          </div>
        ) : (
          <span>No bank account attached</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {a.requirementsDue.length === 0 ? (
          "—"
        ) : (
          <ul className="space-y-0.5">
            {a.requirementsDue.map((r) => (
              <li key={r} className="font-mono">
                {r}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {a.stripeAccountId ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatDateTime(a.lastSyncedAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {a.status === "disabled" ? (
          <Button size="sm" variant="outline" onClick={() => setAction("enable")}>
            Enable
          </Button>
        ) : a.status !== "not_started" ? (
          <Button size="sm" variant="outline" onClick={() => setAction("disable")}>
            Disable
          </Button>
        ) : null}

        <ReasonDialog
          open={action === "disable"}
          onClose={() => setAction(null)}
          title={`Disable Stripe payouts for ${a.agencyName}?`}
          description="Settlements stop being paid out automatically; the host's balance stays in the wallet until re-enabled or paid by bank transfer."
          field={{
            label: "Reason",
            placeholder: "e.g. Bank account under review after a returned payout",
            hint: "Kept on the account; shown to the host.",
            minLength: 2,
            maxLength: 300,
          }}
          confirmLabel="Disable payouts"
          destructive
          onConfirm={async (value) => {
            await AdminApi.disablePayoutAccount(a.agencyId, value ?? "");
            invalidate();
          }}
          mapError={mapAccountError}
        />
        <EnableDialog
          open={action === "enable"}
          onClose={() => setAction(null)}
          account={a}
          onDone={invalidate}
        />
      </td>
    </tr>
  );
}

function EnableDialog({
  open,
  onClose,
  account,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  account: PayoutAccountAdminDto;
  onDone: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => AdminApi.enablePayoutAccount(account.agencyId),
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
      title={`Re-enable Stripe payouts for ${account.agencyName}?`}
      description="The account goes back to the status Stripe reports; automatic payouts resume once it is active."
    >
      {mutation.isError ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {mapAccountError(mutation.error) ??
            getErrorMessage(mutation.error, "Could not enable the account.")}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Keep disabled
        </Button>
        <Button type="button" disabled={busy} onClick={() => mutation.mutate()}>
          {busy ? "Enabling…" : "Enable payouts"}
        </Button>
      </div>
    </Dialog>
  );
}
