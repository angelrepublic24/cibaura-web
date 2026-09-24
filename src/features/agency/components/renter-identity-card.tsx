"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, IdCard, Mail, Phone, User } from "lucide-react";
import { AgencyApi } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Dialog } from "@/shared/components/ui/dialog";
import type { BookingDetail, RenterLicenseDto } from "@/shared/types/domain";
import { formatDateTime, formatIsoDate } from "@/shared/utils/dates";

/** States in which the server exposes the renter's identity (ADR-0011). */
export function identityAvailable(state: BookingDetail["state"]): boolean {
  return state === "accepted" || state === "active" || state === "returned";
}

const DOCUMENT_TYPE_LABELS: Record<string, string | undefined> = {
  license_front: "Driver's licence — front",
  license_back: "Driver's licence — back",
};

function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function describeLicenseError(error: unknown): string {
  if (isApiErrorCode(error, API_ERROR_CODES.IDENTITY_NOT_AVAILABLE)) {
    return "The renter's licence is available from acceptance until the car is returned and settled.";
  }
  return getErrorMessage(error, "Could not load the licence. Please try again.");
}

/**
 * The renter as the HOST sees them (ADR-0011): name always; phone and email
 * from acceptance to return (the server withholds them outside those
 * states); and the licence images behind short-lived signed URLs, minted on
 * click and shown in a modal — every view is logged server-side for the
 * renter's privacy record.
 */
export function RenterIdentityCard({ booking }: { booking: BookingDetail }) {
  const customer = booking.customer;
  const { can } = usePermission();
  const [open, setOpen] = useState(false);

  const license = useMutation({
    mutationFn: () => AgencyApi.renterLicense(booking.id),
    onSuccess: () => setOpen(true),
  });

  if (!customer) return null;

  const available = identityAvailable(booking.state);
  const canView = available && can("bookings:read");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" />
          Renter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-medium text-foreground">{customer.name}</p>
        <ul className="space-y-1 text-sm">
          {customer.email ? (
            <li>
              <a
                href={`mailto:${customer.email}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                {customer.email}
              </a>
            </li>
          ) : null}
          {customer.phone ? (
            <li>
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </a>
            </li>
          ) : null}
          {!customer.email && !customer.phone ? (
            <li className="text-muted-foreground">
              {available
                ? "No contact details on file."
                : "Contact details are shared from acceptance until the car is returned."}
            </li>
          ) : null}
        </ul>

        {canView ? (
          <div className="space-y-2 border-t border-border pt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={license.isPending}
              onClick={() => license.mutate()}
            >
              <IdCard className="h-4 w-4" />
              {license.isPending ? "Loading licence…" : "View driver's licence"}
            </Button>
            {license.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {describeLicenseError(license.error)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Each view is logged for the renter&apos;s privacy record.
            </p>
          </div>
        ) : !available ? (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            The driver&apos;s licence becomes viewable once the booking is accepted, until it
            settles.
          </p>
        ) : null}

        {open && license.data ? (
          <LicenseDialog license={license.data} onClose={() => setOpen(false)} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function LicenseDialog({
  license,
  onClose,
}: {
  license: RenterLicenseDto;
  onClose: () => void;
}) {
  const expiresAt = license.documents[0]?.expiresAt ?? null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={license.fullName}
      description={`Licence ${license.licenseNumber}${
        license.licenseExpiry ? ` · expires ${formatIsoDate(license.licenseExpiry)}` : ""
      }`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {license.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No licence images are on file for this renter.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {license.documents.map((doc) => (
              <li key={`${doc.type}-${doc.url}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {documentTypeLabel(doc.type)}
                  </p>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                </div>
                <DocumentPreview url={doc.url} alt={documentTypeLabel(doc.type)} />
              </li>
            ))}
          </ul>
        )}
        {expiresAt ? (
          <p className="text-xs text-muted-foreground">
            These links expire at {formatDateTime(expiresAt)}; open the licence again for fresh
            ones.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Image preview with a graceful fallback for non-image files (e.g. a PDF). */
function DocumentPreview({ url, alt }: { url: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/40 text-sm text-primary hover:underline"
      >
        This document is a file — open it in a new tab
      </a>
    );
  }
  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL */}
      <img
        src={url}
        alt={alt}
        className="max-h-80 w-full object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  );
}
