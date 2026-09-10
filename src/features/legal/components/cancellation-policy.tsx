"use client";

import { useLegalCurrent } from "@/features/legal/hooks";
import type { CancellationPolicyDto } from "@/shared/types/domain";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** "24 hours" / "1 hour" — the policy numbers are data, never literals. */
export function formatHours(hours: number): string {
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * The three tiers of the cancellation policy, rendered from
 * `GET /legal/current`. Shared by the Terms page, the car page and the
 * booking detail so every surface states the SAME figures the backend
 * enforces. Loading shows a skeleton; on error the copy stays honest and
 * points at the booking page (which shows the server's exact quote).
 */
export function CancellationPolicySummary({
  variant = "list",
  className,
}: {
  /** `list` = bullet list (terms page); `inline` = compact paragraph. */
  variant?: "list" | "inline";
  className?: string;
}) {
  const query = useLegalCurrent();

  if (query.isLoading) {
    return (
      <div className={cn("space-y-2", className)} aria-busy="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        The current cancellation figures could not be loaded. Before you
        cancel, your booking page always shows the exact refund the server
        will issue.{" "}
        <button
          type="button"
          className="text-primary underline underline-offset-2"
          onClick={() => query.refetch()}
        >
          Try again
        </button>
      </p>
    );
  }

  const policy = query.data.cancellationPolicy;

  if (variant === "inline") {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {inlineCopy(policy)}
      </p>
    );
  }

  return (
    <ul className={cn("list-disc space-y-2 pl-5", className)}>
      <li>
        <strong className="text-foreground">Free cancellation</strong> until{" "}
        {formatHours(policy.freeCancellationHours)} before the pickup date:
        the card hold is released or the charge is refunded in full.
      </li>
      <li>
        <strong className="text-foreground">Late cancellation</strong> (less
        than {formatHours(policy.freeCancellationHours)} before pickup):{" "}
        {policy.lateCancellationRetentionPct}% of the rental subtotal is
        retained and paid to the Agency; the remainder — including the
        service fee — is refunded.
      </li>
      <li>
        <strong className="text-foreground">Early return</strong> (recorded by
        the Agency): unused full rental days are refunded, minus a penalty of{" "}
        {formatDays(policy.earlyReturnPenaltyDays)}.
      </li>
    </ul>
  );
}

function inlineCopy(policy: CancellationPolicyDto): string {
  return (
    `Free cancellation until ${formatHours(policy.freeCancellationHours)} ` +
    `before pickup. After that, ${policy.lateCancellationRetentionPct}% of ` +
    `the rental subtotal is retained by the agency and the rest is refunded. ` +
    `Early returns refund unused full days minus ` +
    `${formatDays(policy.earlyReturnPenaltyDays)}.`
  );
}
