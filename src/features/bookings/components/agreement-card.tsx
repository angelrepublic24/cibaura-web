"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileSignature } from "lucide-react";
import { BookingsApi } from "@/features/bookings/api";
import { getErrorMessage } from "@/shared/api/errors";
import type { BookingDetail } from "@/shared/types/domain";
import { useOpenSignedUrl } from "@/shared/hooks/use-open-signed-url";
import { formatDateTime, formatIsoDate } from "@/shared/utils/dates";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * The frozen rental agreement (ADR-0007 + ADR-0010): what the customer
 * accepted, who they were and the car's plate at request time, plus the
 * signed document (immutable HTML/PDF snapshot with the customer's
 * signature, countersigned by the host on acceptance) behind a short-lived
 * PDF link. Absent for bookings made before the snapshot existed (and for
 * walk-ins).
 */
export function AgreementCard({ booking }: { booking: BookingDetail }) {
  const [showConditions, setShowConditions] = useState(false);
  const agreement = booking.agreement;
  const pdf = useOpenSignedUrl(() => BookingsApi.agreementPdf(booking.id));

  if (!agreement) return null;
  const document = agreement.document;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" />
            Rental agreement
          </CardTitle>
          {document ? (
            document.status === "void" ? (
              <Badge variant="secondary">Void</Badge>
            ) : document.countersignedAt ? (
              <Badge variant="success">Signed by both parties</Badge>
            ) : (
              <Badge variant="success">Signed by you</Badge>
            )
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {document ? (
          <div className="space-y-2 rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3">
            <p className="text-foreground">
              Version {document.templateVersion} · you signed on{" "}
              {formatDateTime(document.signedAt)}.
              {document.countersignedAt
                ? ` ${booking.agency.name} countersigned on ${formatDateTime(document.countersignedAt)}.`
                : document.status === "void"
                  ? " The document was voided when the booking closed."
                  : ` ${booking.agency.name} countersigns when they accept your request.`}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pdf.isPending}
                onClick={pdf.open}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {pdf.isPending ? "Preparing PDF…" : "Open signed PDF"}
              </Button>
              {pdf.fallback ? (
                <a
                  href={pdf.fallback.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Your browser blocked the tab — open the PDF here
                </a>
              ) : null}
            </div>
            {pdf.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(pdf.error, "Could not prepare the PDF link.")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The link is private and expires after a few minutes; open it
                again whenever you need it.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No signed document is attached — this booking was created before
            electronic signatures or at the counter. The terms below still
            apply.
          </p>
        )}

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Terms accepted
            </dt>
            <dd className="text-foreground">
              <Link
                href="/legal/terms"
                className="text-primary underline-offset-2 hover:underline"
              >
                Version {agreement.termsVersion}
              </Link>{" "}
              <span className="text-muted-foreground">
                on {formatDateTime(agreement.acceptedAt)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Renter
            </dt>
            <dd className="text-foreground">{agreement.renter.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Driver&apos;s license
            </dt>
            <dd className="text-foreground">
              {agreement.renter.licenseMasked}
              {agreement.renter.licenseExpiry ? (
                <span className="text-muted-foreground">
                  {" "}
                  · valid until {formatIsoDate(agreement.renter.licenseExpiry)}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Vehicle plate
            </dt>
            <dd className="text-foreground">
              {agreement.car.plate ?? (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </dd>
          </div>
        </dl>

        {agreement.agencyConditions ? (
          <div>
            <button
              type="button"
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              aria-expanded={showConditions}
              onClick={() => setShowConditions((v) => !v)}
            >
              {showConditions
                ? "Hide agency conditions"
                : "Show the agency conditions you accepted"}
            </button>
            {showConditions ? (
              <p className="mt-2 whitespace-pre-line rounded-[var(--radius-sm)] bg-muted/60 p-3 leading-relaxed text-muted-foreground">
                {agreement.agencyConditions}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            The agency had no additional conditions at request time.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
