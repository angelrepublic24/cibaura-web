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

/**
 * Statuses that mean "this agency lost the platform".
 *
 * `closed` is the owner's own doing — they deleted their account and the
 * agency went with it — and belongs here even though in principle nobody can
 * be looking at a closed agency: its owner row is anonymized and its staff are
 * unlinked server-side. That unlink is best-effort, and without this the one
 * member it missed would get the whole dashboard, with every panel 403ing
 * separately.
 */
export function isRevokedStatus(
  status: AgencyVerificationStatus | undefined,
): boolean {
  return (
    status === "rejected" || status === "suspended" || status === "closed"
  );
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
 * The three ways an agency loses the dashboard read as three different things
 * to the person in front of it, and the backend answers all three with the
 * same AGENCY_ACCESS_REVOKED code — so the WORDING is the client's job.
 * Telling a suspended partner their application was rejected, or telling the
 * employee of a business its owner closed that they were refused, is false.
 */
const REVOKED_COPY: Partial<
  Record<
    AgencyVerificationStatus,
    { heading: string; lead: string; next: string }
  >
> & { rejected: { heading: string; lead: string; next: string } } = {
  rejected: {
    heading: "Application not approved",
    lead: "Your agency application was not approved, so this account does not have access to the agency dashboard.",
    next: "This decision is final for this application. If you believe it is a mistake, or the reason above is something you can fix, contact Cibaura support before applying again.",
  },
  suspended: {
    heading: "Your agency is suspended",
    lead: "Your agency has been suspended, so the agency dashboard is closed and your cars are not shown to renters.",
    next: "Contact Cibaura support to sort out what led to the suspension — once it is resolved an admin can reactivate your agency and your listings come back.",
  },
  closed: {
    heading: "This agency is closed",
    lead: "The owner of this agency closed it, so the dashboard is gone and its cars are no longer listed.",
    next: "Your own account is unaffected — you can keep renting on Cibaura. To host again, apply with a new agency: a closed one cannot be reopened.",
  },
};

/**
 * Full-surface state for an agency that lost the dashboard — rejected,
 * suspended, or closed by its owner — replacing the entire dashboard chrome
 * (nav + pages), which would otherwise just fire 403s.
 * Rejection is terminal: no re-submit path, only the verdict, its reason and
 * who to talk to.
 *
 * The rejection email links straight here, so this screen is the WHOLE answer
 * the person gets. It therefore also carries the exits: the account that was
 * refused as a supplier is still a customer, and leaving them on a dead end
 * with a single "back to home" would quietly end that relationship too.
 *
 * `status` picks the wording from {@link REVOKED_COPY}, and defaults to the
 * rejected copy for callers that have no status at hand.
 */
export function AgencyAccessRevoked({
  status = "rejected",
  reason,
}: {
  status?: AgencyVerificationStatus;
  reason?: string | null;
}) {
  const { heading, lead, next } = REVOKED_COPY[status] ?? REVOKED_COPY.rejected;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </span>
      <h1 className="font-display text-xl text-foreground">{heading}</h1>
      <p className="text-sm text-muted-foreground">{lead}</p>
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
        <p className="mt-1 text-sm text-muted-foreground">{next}</p>
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
