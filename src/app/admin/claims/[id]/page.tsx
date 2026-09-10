"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Gavel } from "lucide-react";
import { ClaimDecideDialog } from "@/features/admin/components/claim-decide-dialog";
import { InspectionBlock } from "@/features/admin/components/inspection-media-grid";
import {
  ClaimAmounts,
  claimCurrency,
  DepositCard,
} from "@/features/admin/components/order-lifecycle-cards";
import { useAdminClaim } from "@/features/admin/hooks";
import { getErrorMessage } from "@/shared/api/errors";
import type { ClaimAdminDto } from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import { ClaimStatusBadge } from "@/shared/components/claim-deposit-labels";
import { useNow } from "@/shared/hooks/use-now";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { formatDateTime, formatRemaining } from "@/shared/utils/dates";

/**
 * /admin/claims/[id] — one damage claim (ADR-0013): amounts, the host's
 * description, the customer's response, the deposit state, and the
 * check-in/check-out evidence (media the host attached are outlined). The
 * decision modal is offered while the claim is `under_review` — `open`
 * claims still belong to the customer until the response window closes.
 */
export default function AdminClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAdminClaim(id);

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div className="space-y-6">
        <Link
          href="/admin/claims"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to claims
        </Link>

        {query.isPending ? (
          <LoadingState label="Loading claim…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load this claim"
            message={getErrorMessage(query.error, "Please try again.")}
            onRetry={() => query.refetch()}
          />
        ) : (
          <ClaimDetail claim={query.data} />
        )}
      </div>
    </RoleGuard>
  );
}

function ClaimDetail({ claim }: { claim: ClaimAdminDto }) {
  const [decideOpen, setDecideOpen] = useState(false);
  const now = useNow();
  const currency = claimCurrency(claim.deposit);
  const respondBy = new Date(claim.respondBy).getTime();
  const decidable = claim.status === "under_review";
  const evidence = new Set(claim.evidenceMediaIds);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-foreground">
              Claim by {claim.agencyName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Against {claim.customerName} · filed {formatDateTime(claim.createdAt)}
            </p>
            <Link
              href={`/admin/orders/${claim.bookingId}`}
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Open the order
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Amounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ClaimAmounts claim={claim} currency={currency} />
            <div>
              <p className="text-xs text-muted-foreground">Host&apos;s description</p>
              <p className="mt-1 whitespace-pre-line rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-foreground">
                {claim.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {claim.customerResponse === "accepted" ? (
              <p className="text-success">
                The customer accepted the claim — it was approved automatically
                at the requested amount (capped by the deposit).
              </p>
            ) : claim.customerResponse === "rejected" ? (
              <p className="text-foreground">The customer rejected the claim.</p>
            ) : claim.status === "open" ? (
              <p className="text-muted-foreground">
                Waiting for the customer until {formatDateTime(claim.respondBy)}
                {respondBy > now ? ` (${formatRemaining(respondBy - now)} left)` : " — window closed, escalating"}
                .
              </p>
            ) : (
              <p className="text-muted-foreground">
                The customer did not respond before {formatDateTime(claim.respondBy)}.
              </p>
            )}
            {claim.customerNote ? (
              <p className="whitespace-pre-line rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-foreground">
                {claim.customerNote}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            {claim.inspections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No inspection records are attached to this booking.
              </p>
            ) : (
              <div className="space-y-8">
                {claim.inspections.map((i) => (
                  <InspectionBlock key={i.id} inspection={i} highlightIds={evidence} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <DepositCard
          deposit={claim.deposit}
          bookingDepositCents={claim.deposit?.amountCents ?? 0}
          currency={currency}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-4 w-4 text-primary" />
              Decision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {claim.decidedAt ? (
              <>
                <p className="text-muted-foreground">
                  Decided {formatDateTime(claim.decidedAt)}.
                </p>
                {claim.decisionNote ? (
                  <p className="whitespace-pre-line rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-foreground">
                    {claim.decisionNote}
                  </p>
                ) : null}
              </>
            ) : decidable ? (
              <>
                <p className="text-muted-foreground">
                  Review the evidence, then approve an amount the deposit
                  covers or reject the claim. Both parties are notified and
                  the booking settles afterwards.
                </p>
                <Button onClick={() => setDecideOpen(true)}>Decide…</Button>
              </>
            ) : claim.status === "open" ? (
              <p className="text-muted-foreground">
                The customer&apos;s response window is still open. The claim
                becomes decidable when they reject it or the window closes.
              </p>
            ) : (
              <p className="text-muted-foreground">
                No decision is pending for this claim.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ClaimDecideDialog
        open={decideOpen}
        onClose={() => setDecideOpen(false)}
        claim={claim}
      />
    </div>
  );
}
