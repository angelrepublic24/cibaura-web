"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { agencyKeys } from "./api";
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
 * Rejection is terminal: no re-submit path, only the reason + support
 * guidance.
 */
export function AgencyAccessRevoked({
  reason,
}: {
  reason?: string | null;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </span>
      <h1 className="font-display text-xl text-foreground">
        Agency access revoked
      </h1>
      <p className="text-sm text-muted-foreground">
        Your agency application was rejected, so this account no longer has
        access to the agency platform.
      </p>
      {reason ? (
        <div className="w-full rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-destructive">
            Reason
          </p>
          <p className="mt-1 text-sm text-foreground">{reason}</p>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        If you believe this is a mistake or want to appeal the decision,
        contact Cibaura support.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to home
      </Link>
    </div>
  );
}
