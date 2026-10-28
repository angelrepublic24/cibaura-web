"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { agencyKeys } from "@/modules/agency/hooks/agency.hook";
import type { AgencyVerificationStatus } from "@/shared/types/domain";
import { buttonVariants } from "@/shared/components/ui/button";

/**
 * Stable machine code the backend puts on every 403 it returns for a
 * REJECTED/SUSPENDED agency (owner rule: "Si una agencia es rechazada, no
 * puede tener acceso a la plataforma"). Clients key off the CODE, never the
 * human message.
 */
export const AGENCY_ACCESS_REVOKED_CODE = "AGENCY_ACCESS_REVOKED";

/** Statuses that mean "this agency lost the platform". */
export function isRevokedStatus(
  status: AgencyVerificationStatus | undefined,
): boolean {
  return status === "rejected" || status === "suspended";
}

/** True when an (axios) error is the backend's revoked-agency 403. */
export function isAgencyAccessRevokedError(error: unknown): boolean {
  const data = (
    error as { response?: { data?: { code?: string } } } | null | undefined
  )?.response?.data;
  return data?.code === AGENCY_ACCESS_REVOKED_CODE;
}

/**
 * Mid-session revocation watcher: if ANY query or mutation under the agency
 * dashboard fails with the revoked-agency 403 (the admin rejected the agency
 * while the user was working), force a refetch of `GET /agency/session` —
 * the one read the backend keeps answering — so the layout swaps the whole
 * surface to {@link AgencyAccessRevoked} instead of every panel erroring
 * separately.
 */
export function useAgencyAccessRevokedWatcher(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const onError = (error: unknown) => {
      if (!isAgencyAccessRevokedError(error)) return;
      void qc.invalidateQueries({ queryKey: agencyKeys.session() });
    };
    const unsubQueries = qc.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        onError(event.action.error);
      }
    });
    const unsubMutations = qc.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        onError(event.action.error);
      }
    });
    return () => {
      unsubQueries();
      unsubMutations();
    };
  }, [qc]);
}

/**
 * Full-surface state for a rejected/suspended agency — replaces the entire
 * dashboard chrome (nav + pages), which would otherwise just fire 403s.
 * Rejection is terminal: no re-submit path, only the verdict, its reason and
 * who to talk to.
 *
 * The rejection email links straight here, so this screen is the WHOLE answer
 * the person gets. It therefore also carries the exits: the account that was
 * refused as a supplier is still a customer, and leaving them on a dead end
 * with a single "back to home" would quietly end that relationship too.
 *
 * `status` picks the wording: a suspension is an interruption of a verified
 * agency, not a refused application, and saying "your application was
 * rejected" to a suspended partner is simply wrong. It defaults to the
 * rejected copy for callers that have no status at hand.
 */
export function AgencyAccessRevoked({
  status = "rejected",
  reason,
}: {
  status?: AgencyVerificationStatus;
  reason?: string | null;
}) {
  const suspended = status === "suspended";

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </span>
      <h1 className="font-display text-xl text-foreground">
        {suspended ? "Your agency is suspended" : "Application not approved"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {suspended
          ? "Your agency has been suspended, so the agency dashboard is closed and your cars are not shown to renters."
          : "Your agency application was not approved, so this account does not have access to the agency dashboard."}
      </p>
      {reason ? (
        <div className="w-full rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-destructive">
            Reason
          </p>
          <p className="mt-1 text-sm text-foreground">{reason}</p>
        </div>
      ) : null}
      <div className="w-full rounded-[var(--radius)] border border-border bg-surface p-4 text-left">
        <p className="text-sm font-medium text-foreground">What to do next</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {suspended
            ? "Contact Cibaura support to sort out what led to the suspension — once it is resolved an admin can reactivate your agency and your listings come back."
            : "This decision is final for this application. If you believe it is a mistake, or the reason above is something you can fix, contact Cibaura support before applying again."}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Your customer account is untouched — you can keep renting cars on
        Cibaura.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Browse cars
        </Link>
        <Link
          href="/account"
          className={buttonVariants({ variant: "outline" })}
        >
          My rentals
        </Link>
      </div>
    </div>
  );
}
