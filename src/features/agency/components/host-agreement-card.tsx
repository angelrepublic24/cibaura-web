"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, FilePenLine } from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import {
  HostAgreementSigner,
  HostAgreementSignedSummary,
} from "@/features/agencies/components/host-agreement-signer";
import { getErrorMessage } from "@/shared/api/errors";
import type { SignedUrlDto } from "@/shared/types/domain";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * Settings card for the host agreement (ADR-0010): current status, a
 * short-lived link to the signed PDF, and — when the host never signed or a
 * newer template version requires it — the re-sign banner with the inline
 * signer (owner-only; staff read an explanation).
 */
export function HostAgreementCard() {
  const query = useQuery({
    queryKey: agencyKeys.hostAgreement(),
    queryFn: AgencyApi.hostAgreement,
  });

  // The PDF lives behind a signed URL that expires in minutes, so it is
  // minted on click. The tab is opened SYNCHRONOUSLY (popup blockers allow
  // that) and pointed at the URL once it lands; when the browser still
  // blocks it, the link is rendered inline instead.
  const [fallbackLink, setFallbackLink] = useState<SignedUrlDto | null>(null);
  const pdf = useMutation({
    mutationFn: async () => {
      const tab = window.open("about:blank", "_blank");
      const signed = await AgencyApi.hostAgreementPdf();
      if (tab) {
        tab.location.href = signed.url;
      } else {
        setFallbackLink(signed);
      }
    },
  });

  if (query.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Host agreement</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState label="Loading the host agreement…" className="py-6" />
        </CardContent>
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Host agreement</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Could not load the host agreement"
            message={getErrorMessage(query.error, "Please try again.")}
            onRetry={() => query.refetch()}
            className="py-8"
          />
        </CardContent>
      </Card>
    );
  }

  const status = query.data;
  const signed = status.signed;
  const needsSignature = !signed || status.resignRequired;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FilePenLine className="h-4 w-4 text-primary" />
            Host agreement
          </CardTitle>
          {!signed ? (
            <Badge variant="warning">Not signed</Badge>
          ) : status.resignRequired ? (
            <Badge variant="warning">New version to sign</Badge>
          ) : (
            <Badge variant="success">Signed · v{signed.templateVersion}</Badge>
          )}
        </div>
        <CardDescription>
          Your association agreement with the platform. Cars can only be
          published once it is signed; the signed copy is kept as an
          immutable PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signed ? (
          <div className="space-y-2">
            <HostAgreementSignedSummary document={signed} />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pdf.isPending}
                onClick={() => {
                  setFallbackLink(null);
                  pdf.mutate();
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {pdf.isPending ? "Preparing PDF…" : "Open signed PDF"}
              </Button>
              {fallbackLink ? (
                <a
                  href={fallbackLink.url}
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
            ) : null}
          </div>
        ) : null}

        {needsSignature ? (
          <div className="space-y-3">
            {!signed ? (
              <p
                className="rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft p-3 text-sm text-warning"
                role="status"
              >
                The host agreement has not been signed yet. Until the owner
                signs it, cars cannot be activated and requests cannot be
                accepted.
              </p>
            ) : null}
            <HostAgreementSigner />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
