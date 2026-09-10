"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { CONTRACT_KIND_RENTAL_AGREEMENT } from "@/features/legal/api";
import { usePublicContract } from "@/features/legal/hooks";
import { CancellationPolicySummary } from "@/features/legal/components/cancellation-policy";
import { ContractHtml } from "@/features/legal/components/contract-html";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { formatMoneyCents } from "@/shared/utils/money";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * "Deposit and cancellation policy" on the car page: the security deposit
 * frozen for this car (`CarDetailDto.depositCents` — car override or the
 * platform default, decided server-side), the three policy tiers from
 * `GET /legal/current`, and the published rental agreement
 * (`GET /legal/contracts/rental_agreement`, generic placeholders) so the
 * customer can read what they will sign BEFORE choosing dates.
 */
export function RentalPolicyCard({
  depositCents,
  agencyName,
  className,
}: {
  depositCents: number;
  agencyName: string;
  className?: string;
}) {
  const [showAgreement, setShowAgreement] = useState(false);
  const contract = usePublicContract(
    CONTRACT_KIND_RENTAL_AGREEMENT,
    showAgreement,
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Deposit and cancellation policy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-[var(--radius-sm)] bg-muted/60 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Security deposit
          </p>
          {depositCents > 0 ? (
            <>
              <p className="mt-0.5 text-lg font-semibold text-foreground">
                {formatMoneyCents(depositCents)}
              </p>
              <p className="mt-1 text-muted-foreground">
                Held on your card when {agencyName} starts the check-in — not
                charged — and released after check-out. If the host reports
                damage, you can accept or reject the claim before anything is
                captured; an admin decides when you disagree.
              </p>
            </>
          ) : (
            <p className="mt-0.5 font-semibold text-foreground">
              No deposit for this car
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Cancellation and early return
          </p>
          <CancellationPolicySummary variant="list" className="text-sm" />
        </div>

        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
            aria-expanded={showAgreement}
            onClick={() => setShowAgreement((v) => !v)}
          >
            {showAgreement ? (
              <>
                Hide the rental agreement <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Read the rental agreement you will sign{" "}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          {showAgreement ? (
            contract.isLoading ? (
              <div className="mt-2 space-y-2" aria-busy="true">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : contract.isError ? (
              <div className="mt-2 space-y-2 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3">
                <p className="text-muted-foreground">
                  {isApiErrorCode(
                    contract.error,
                    API_ERROR_CODES.TEMPLATE_NOT_PUBLISHED,
                  )
                    ? "The rental agreement is not published yet. You will read the full text before signing your request."
                    : getErrorMessage(
                        contract.error,
                        "The agreement could not be loaded right now.",
                      )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => contract.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : contract.data ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {contract.data.title}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Version {contract.data.version}
                  </span>
                </div>
                <ContractHtml html={contract.data.html} className="max-h-80" />
                <p className="text-xs text-muted-foreground">
                  Bracketed placeholders are filled in with your details, the
                  car and the host when you request — you will see and sign
                  that exact text.
                </p>
              </div>
            ) : null
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
