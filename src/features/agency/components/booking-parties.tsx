import { FileSignature, Mail, Phone, User } from "lucide-react";
import type {
  BookingAgreement,
  BookingCustomerDto,
} from "@/shared/types/domain";
import { formatIsoDate } from "@/shared/utils/dates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * Renter identity as the agency/admin sees it (`booking.customer`, emitted
 * only for that viewer). Phone and email are actionable links so a
 * salesperson can call about a pickup in one tap.
 */
export function CustomerCard({ customer }: { customer: BookingCustomerDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" />
          Customer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium text-foreground">{customer.name}</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <a
              href={`mailto:${customer.email}`}
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {customer.email}
            </a>
          </li>
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
          ) : (
            <li className="text-muted-foreground">No phone on file</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The frozen rental agreement (ADR-0007): what the renter accepted, when,
 * under which terms version, plus the license (masked) and plate as they
 * were that day. Null on the wire → an honest "no agreement" note (walk-ins
 * and bookings that predate the snapshot).
 */
export function AgreementCard({
  agreement,
}: {
  agreement: BookingAgreement | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4 text-primary" />
          Rental agreement
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!agreement ? (
          <p className="text-sm text-muted-foreground">
            No agreement snapshot for this booking (counter sales and older
            bookings have none).
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Row label="Terms version" value={agreement.termsVersion} />
              <Row label="Accepted" value={fmtDateTime(agreement.acceptedAt)} />
              <Row label="Renter" value={agreement.renter.fullName} />
              <Row
                label="Driver's license"
                value={agreement.renter.licenseMasked}
              />
              <Row
                label="License expiry"
                value={
                  agreement.renter.licenseExpiry
                    ? formatIsoDate(agreement.renter.licenseExpiry)
                    : "—"
                }
              />
              <Row label="Plate" value={agreement.car.plate ?? "—"} />
            </dl>
            <div>
              <p className="text-xs text-muted-foreground">
                Agency conditions at request time
              </p>
              {agreement.agencyConditions ? (
                <p className="mt-1 whitespace-pre-line rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-foreground">
                  {agreement.agencyConditions}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  The agency had no written conditions when this was requested.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
