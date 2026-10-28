"use client";

import { useLegalCurrent } from "@/modules/legal/hooks/legal.hook";
import {
  formatDays,
  formatHours,
} from "@/modules/legal/helpers/legal.helper";
import type { CancellationPolicyDto } from "@/shared/types/domain";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
        <strong className="text-foreground">Free cancellation</strong> for{" "}
        {formatHours(policy.freeCancellationHours)} after the agency accepts
        your booking: your card is only held until then, and cancelling
        inside the window releases it in full.
      </li>
      <li>
        <strong className="text-foreground">Shorter for a booking that
        starts soon.</strong>{" "}
        The window never runs closer than{" "}
        {formatHours(policy.freeCancellationCapHoursBeforePickup)} to the
        pickup, and is never shorter than{" "}
        {formatHours(policy.freeCancellationMinHours)} — so a last-minute
        booking still gets one.
      </li>
      <li>
        <strong className="text-foreground">After the window</strong>:{" "}
        {policy.lateCancellationRetentionPct}% of what you paid is retained
        and paid to the Agency; the rest is refunded.
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
    `Free cancellation for ${formatHours(policy.freeCancellationHours)} ` +
    `after the agency accepts — never closer than ` +
    `${formatHours(policy.freeCancellationCapHoursBeforePickup)} to the ` +
    `pickup and never under ${formatHours(policy.freeCancellationMinHours)}. ` +
    `After that, ${policy.lateCancellationRetentionPct}% of what you paid is ` +
    `retained by the agency and the rest is refunded. Early returns refund ` +
    `unused full days minus ${formatDays(policy.earlyReturnPenaltyDays)}.`
  );
}
