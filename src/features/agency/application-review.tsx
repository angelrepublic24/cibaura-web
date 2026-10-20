"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarRange,
  Clock,
  FilePenLine,
  Search,
  Upload,
} from "lucide-react";
import { AgenciesApi, applyKeys } from "@/features/agencies/api";
import {
  agencyDocumentTypeLabel,
  formatUploadedDate,
} from "@/features/agencies/components/agency-document-uploader";
import {
  AGENCY_SIGNUP_PATH,
  HOST_SIGNUP_PATH,
} from "@/shared/config/supply";
import { Badge } from "@/shared/components/ui/badge";
import { buttonVariants } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDateTime } from "@/shared/utils/dates";
import type { Agency } from "@/shared/types/domain";

/**
 * Full-surface state for a PENDING agency — it REPLACES the dashboard chrome
 * the way {@link AgencyAccessRevoked} does for a rejected one.
 *
 * Owner rule: an applicant enters the agency space but writes nothing until an
 * admin verifies them; what they see is the state of their application. The
 * backend enforces it (every mutation under `/agency` answers
 * `403 AGENCY_APPLICATION_UNDER_REVIEW`), so rendering the real dashboard here
 * would be a wall of buttons that all fail. Replacing it is also lossless:
 * `pending` only ever precedes the first approval — the admin switch toggles
 * `verified ⇄ suspended`, never back to `pending` — so a pending agency has no
 * fleet, no bookings and no staff to hide.
 *
 * The screen answers the three questions an applicant actually has: where am
 * I, what did I send, and what happens next — plus the two things they CAN
 * still do (documents, agreement) and the reminder that their customer account
 * is untouched.
 */
export function AgencyApplicationReview({ agency }: { agency: Agency }) {
  const individual = agency.kind === "individual";
  const funnelPath = individual ? HOST_SIGNUP_PATH : AGENCY_SIGNUP_PATH;

  // The applicant's own file: status, KYC block and documents on record.
  // Deliberately outside the agency access gate server-side, but owner-only —
  // `agency_staff` of a pending agency gets a 403, which degrades to the
  // "could not load" note below rather than breaking the page. A 403 is a
  // verdict, not a blip: never retry it.
  const applicationQuery = useQuery({
    queryKey: applyKeys.application(agency.id),
    queryFn: () => AgenciesApi.application(agency.id),
    staleTime: 60_000,
    retry: false,
  });
  const application = applicationQuery.data;

  const kyc: { label: string; value: string }[] = application
    ? [
        { label: "Legal name", value: application.kyc.legalName ?? "" },
        { label: "Tax ID (RNC)", value: application.kyc.taxId ?? "" },
        { label: "Owner", value: application.kyc.ownerName ?? "" },
        { label: "ID number", value: application.kyc.ownerIdNumber ?? "" },
        { label: "Phone", value: application.kyc.phone ?? "" },
        { label: "Address", value: application.kyc.address ?? "" },
      ].filter((row) => row.value !== "")
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Card className="border-warning/30 bg-warning-soft">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15">
                <Clock className="h-5 w-5 text-warning" />
              </span>
              <div>
                <h1 className="font-display text-xl text-foreground">
                  {individual
                    ? "Your host application is under review"
                    : "Your agency application is under review"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {agency.name} is with our verification team. The dashboard —
                  cars, bookings, branches, staff and payouts — unlocks the
                  moment you are verified. Until then nothing can be added or
                  changed here.
                </p>
              </div>
            </div>
            <Badge variant="warning">Pending review</Badge>
          </div>
          {application ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Submitted {formatDateTime(application.createdAt)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            What you sent us
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {applicationQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : applicationQuery.isError ? (
            // One fixed sentence rather than the server's message: the only
            // predictable failure here is the ownership 403 an agency_staff
            // member gets, and "Forbidden resource" explains nothing to them.
            <p className="text-sm text-muted-foreground">
              Could not load the application details — they are visible only to
              the owner of the agency.
            </p>
          ) : application ? (
            <>
              {kyc.length > 0 ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {kyc.map((row) => (
                    <div key={row.label}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="text-sm text-foreground">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Documents on record
                </p>
                {application.documents.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    None yet — uploading them is the fastest way to move your
                    application forward.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-border rounded-[var(--radius-sm)] border border-border">
                    {application.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                      >
                        <span className="min-w-0 truncate text-foreground">
                          {agencyDocumentTypeLabel(doc.type)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatUploadedDate(doc.uploadedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Only worth a line when there is something to wait on. */}
              {application.carDocumentsPending > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {application.carDocumentsPending} car registration document
                  {application.carDocumentsPending === 1 ? " is" : "s are"} also
                  waiting for review.
                </p>
              ) : null}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Host agreement
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {agency.hostAgreementSigned ? "Signed" : "Not signed yet"}
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            What happens next
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {NEXT_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* The only two writes the platform still accepts from an applicant —
          both are paperwork of the application itself, not operations. */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            What you can do now
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href={funnelPath}
            className={buttonVariants({ variant: "outline" })}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload or replace documents
          </Link>
          {agency.hostAgreementSigned ? null : (
            <Link
              href={funnelPath}
              className={buttonVariants({ variant: "outline" })}
            >
              <FilePenLine className="mr-2 h-4 w-4" />
              Sign the host agreement
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Your customer account is unaffected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Applying did not change how you rent on Cibaura — you can keep
            booking cars while we review this.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className={buttonVariants({ variant: "default" })}>
              <Search className="mr-2 h-4 w-4" />
              Browse cars
            </Link>
            <Link
              href="/account"
              className={buttonVariants({ variant: "outline" })}
            >
              <CalendarRange className="mr-2 h-4 w-4" />
              My rentals
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const NEXT_STEPS: { title: string; body: string }[] = [
  {
    title: "We check your documents",
    body: "Our team reviews your details and the documents you uploaded — usually within a few business days.",
  },
  {
    title: "We email you the decision",
    body: "Approved or not, the decision lands in your inbox and in your notifications.",
  },
  {
    title: "The dashboard unlocks",
    body: "Once verified you can add cars, branches, staff and start receiving booking requests.",
  },
];
