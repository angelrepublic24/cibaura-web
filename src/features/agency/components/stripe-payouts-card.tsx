"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type { PayoutAccountDto } from "@/shared/types/domain";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { PayoutAccountStatusBadge } from "@/shared/components/wallet-labels";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/** `?stripe=` values Stripe sends the host back with (spec §4/B11). */
type StripeReturn = "return" | "refresh";

function parseStripeReturn(value: string | null): StripeReturn | null {
  return value === "return" || value === "refresh" ? value : null;
}

function fmtDateTime(iso: string): string {
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

/** `bank_accounts.local.status` → "bank accounts local status" (Stripe requirement keys). */
function humanizeRequirement(key: string): string {
  return key.replace(/[._]/g, " ");
}

function describeLinkError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.PAYOUT_RAIL_DISABLED:
      return "Stripe payouts are switched off on the platform right now. Manual bank transfers keep working.";
    case API_ERROR_CODES.OWNER_ONLY:
      return "Only the agency owner can set up Stripe payouts.";
    case API_ERROR_CODES.PAYOUT_ACCOUNT_NOT_ACTIVE:
      return "Your Stripe payout account is not active yet — finish the setup first.";
    default:
      return getErrorMessage(error, "Could not open the Stripe setup.");
  }
}

const STATUS_COPY: Record<string, string> = {
  not_started:
    "Connect a Dominican bank account through Stripe and every settlement is sent to it automatically after the dispute window — no manual payout requests.",
  onboarding:
    "Stripe still needs a few details before payouts can start. Continue where you left off.",
  restricted:
    "Stripe paused payouts to this account until the information below is provided.",
  active:
    "Settlements are sent to your bank automatically. You can still request a manual payout of any remaining balance below.",
  disabled:
    "Payouts to this account were disabled by the platform. Contact support to sort it out.",
};

const ACTION_LABEL: Record<string, string> = {
  not_started: "Set up payouts",
  onboarding: "Continue setup",
  restricted: "Update details",
  active: "Update bank details",
};

/**
 * "Payouts by Stripe" — the host's Stripe Global Payouts recipient
 * (ADR-0012). Reads `GET /agency/payout-account`; "Set up payouts" mints a
 * single-use onboarding link (owner + `wallet:withdraw`) and opens it in
 * the SAME tab. Stripe returns to `/agency/wallet?stripe=return` (done) or
 * `?stripe=refresh` (link expired): `return` triggers a `sync` so the card
 * reflects what Stripe now knows; the query param is then dropped from the
 * URL so a reload does not re-sync.
 *
 * Reads `useSearchParams` — mount inside a `<Suspense>` boundary.
 */
export function StripePayoutsCard() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, role } = usePermission();
  const stripeReturn = parseStripeReturn(searchParams.get("stripe"));

  const accountQuery = useQuery({
    queryKey: agencyKeys.payoutAccount(),
    queryFn: AgencyApi.payoutAccount,
  });

  const sync = useMutation({
    mutationFn: AgencyApi.syncPayoutAccount,
    onSuccess: (account) => {
      qc.setQueryData<PayoutAccountDto>(agencyKeys.payoutAccount(), account);
      // The wallet DTO embeds `payoutAccount` too.
      qc.invalidateQueries({ queryKey: agencyKeys.wallet() });
    },
  });

  const link = useMutation({
    mutationFn: AgencyApi.payoutAccountOnboardingLink,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  // Handle the Stripe round-trip exactly once per page load: both outcomes
  // re-read the recipient (a `refresh` may still carry partial progress).
  const [notice, setNotice] = useState<StripeReturn | null>(null);
  const handledReturn = useRef(false);
  const { mutate: runSync } = sync;
  useEffect(() => {
    if (!stripeReturn || handledReturn.current) return;
    handledReturn.current = true;
    setNotice(stripeReturn);
    runSync();
    router.replace(pathname);
  }, [stripeReturn, runSync, router, pathname]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            Payouts by Stripe
          </CardTitle>
          {accountQuery.isSuccess ? (
            <PayoutAccountStatusBadge status={accountQuery.data.status} />
          ) : null}
        </div>
        <CardDescription>
          Automatic settlement payouts to your bank, handled by Stripe. Paid
          in Dominican pesos at Stripe&apos;s exchange rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice === "return" ? (
          <p
            className="rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3 text-sm text-muted-foreground"
            role="status"
          >
            {sync.isPending
              ? "Welcome back — checking your Stripe setup…"
              : sync.isError
                ? "We could not refresh your Stripe status automatically. Use \"Refresh status\" below."
                : "Stripe setup updated."}
          </p>
        ) : notice === "refresh" ? (
          <p
            className="rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft p-3 text-sm text-warning"
            role="status"
          >
            {sync.isPending
              ? "Your Stripe setup link expired — checking what was saved…"
              : "Your Stripe setup link expired or was interrupted. Start it again from the button below — nothing was lost."}
          </p>
        ) : null}

        {accountQuery.isPending ? (
          <LoadingState label="Loading Stripe payout status…" className="py-4" />
        ) : accountQuery.isError ? (
          <ErrorState
            title="Could not load your Stripe payout status"
            message={getErrorMessage(accountQuery.error, "Please try again.")}
            onRetry={() => accountQuery.refetch()}
            className="py-6"
          />
        ) : (
          <AccountBody
            account={accountQuery.data}
            canSetUp={role === "owner" && can("wallet:withdraw")}
            isOwner={role === "owner"}
            onSetUp={() => link.mutate()}
            settingUp={link.isPending}
            linkError={link.isError ? describeLinkError(link.error) : null}
            onSync={() => sync.mutate()}
            syncing={sync.isPending}
            syncError={
              sync.isError && notice === null
                ? getErrorMessage(sync.error, "Could not refresh the status.")
                : null
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function AccountBody({
  account,
  canSetUp,
  isOwner,
  onSetUp,
  settingUp,
  linkError,
  onSync,
  syncing,
  syncError,
}: {
  account: PayoutAccountDto;
  canSetUp: boolean;
  isOwner: boolean;
  onSetUp: () => void;
  settingUp: boolean;
  linkError: string | null;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
}) {
  const actionLabel = ACTION_LABEL[account.status];
  const showAction = account.onboardingAvailable && !!actionLabel;
  const method = account.payoutMethod;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {STATUS_COPY[account.status] ?? "Stripe reported an unknown status."}
      </p>

      {method ? (
        <div className="rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Bank account on file
          </p>
          <p className="mt-0.5 font-medium text-foreground">
            {method.bankName ?? "Bank account"}
            {method.last4 ? ` •••• ${method.last4}` : ""}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {method.currency}
            </span>
          </p>
        </div>
      ) : null}

      {account.requirementsDue.length > 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft p-3 text-sm">
          <p className="font-medium text-warning">Stripe still needs</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {account.requirementsDue.map((key) => (
              <li
                key={key}
                className="rounded-full border border-warning/30 bg-surface px-2 py-0.5 text-xs text-foreground"
              >
                {humanizeRequirement(key)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!account.onboardingAvailable ? (
        <p className="text-xs text-muted-foreground">
          Stripe payouts are not enabled on this platform yet. Manual bank
          transfers (below) keep working meanwhile.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {showAction && canSetUp ? (
          <Button type="button" disabled={settingUp} onClick={onSetUp}>
            <ExternalLink className="h-4 w-4" />
            {settingUp ? "Opening Stripe…" : actionLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={onSync}
        >
          <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {syncing ? "Refreshing…" : "Refresh status"}
        </Button>
        {account.lastSyncedAt ? (
          <span className="text-xs text-muted-foreground">
            Last checked {fmtDateTime(account.lastSyncedAt)}
          </span>
        ) : null}
      </div>

      {showAction && !canSetUp ? (
        <p className="text-xs text-muted-foreground">
          {isOwner
            ? "You need the \"Withdraw money\" permission to set up payouts."
            : "Only the agency owner can set up or change Stripe payouts."}
        </p>
      ) : null}

      {linkError ? (
        <p className="text-sm text-destructive" role="alert">
          {linkError}
        </p>
      ) : null}
      {syncError ? (
        <p className="text-sm text-destructive" role="alert">
          {syncError}
        </p>
      ) : null}
    </div>
  );
}
