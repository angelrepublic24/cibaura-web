"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePenLine } from "lucide-react";
import {
  AgenciesApi,
  applyKeys,
  type AgencyApplication,
  type ApplyAgencyInput,
} from "@/features/agencies/api";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import {
  AgencyDocumentUploader,
  agencyDocumentTypeLabel,
  formatUploadedDate,
  type RequiredAgencyDocument,
} from "@/features/agencies/components/agency-document-uploader";
import {
  HostAgreementSigner,
  HostAgreementSignedSummary,
} from "@/features/agencies/components/host-agreement-signer";
import type { AgencyVerificationStatus } from "@/shared/types/domain";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

/**
 * The three-step "apply as an agency" flow for a signed-in customer.
 *
 *   Step 1 (form)      -> AgenciesApi.apply(...)  submits the KYC application.
 *   Step 2 (documents) -> uploads business_registration + owner_id.
 *   Step 3 (agreement) -> signs the host agreement (ADR-0010) — required
 *                         before any car can be published.
 *
 * The server is the real authority — it re-validates every field and every
 * upload. This component only shapes input and surfaces the exact server
 * error (`e.message`) on failure.
 *
 * On a return visit (application already submitted) the applicant's documents
 * come back non-empty, so we skip the form and land them on the documents /
 * pending step, with the agreement status shown alongside.
 */

type Step = "form" | "documents" | "agreement";

const REQUIRED_DOCS: RequiredAgencyDocument[] = [
  {
    type: "business_registration",
    label: "Business registration",
    hint: "Mercantile registry / incorporation document (or your RNC certificate).",
  },
  {
    type: "owner_id",
    label: "Owner ID",
    hint: "Government-issued ID of the owner named above.",
  },
];

function StatusBadge({ status }: { status: AgencyVerificationStatus }) {
  if (status === "verified") return <Badge variant="success">Verified</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending review</Badge>;
}

export function ApplyForm({
  alreadyApplied = false,
  status,
}: {
  /** The caller already owns a PENDING agency → skip the form, land straight
   *  on the documents step so they can (re)upload while under review.
   *  Rejection is terminal (the backend 403s uploads): rejected/suspended
   *  owners never reach this form — /become-agency shows the access-revoked
   *  state instead. */
  alreadyApplied?: boolean;
  status?: AgencyVerificationStatus;
} = {}) {
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(alreadyApplied ? "documents" : "form");
  const [application, setApplication] = useState<AgencyApplication | null>(null);
  const isMember = alreadyApplied || application !== null;

  // Application form fields (controlled — keeps validation simple).
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerIdNumber, setOwnerIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const documentsQuery = useQuery({
    queryKey: applyKeys.myDocuments(),
    queryFn: AgenciesApi.myDocuments,
  });

  // Host agreement status — only meaningful once the agency exists.
  const agreementQuery = useQuery({
    queryKey: agencyKeys.hostAgreement(),
    queryFn: AgencyApi.hostAgreement,
    enabled: isMember,
  });
  const agreementSigned =
    agreementQuery.isSuccess &&
    agreementQuery.data.signed !== null &&
    !agreementQuery.data.resignRequired;

  // If they already applied on a previous visit their documents come back
  // non-empty — jump straight to the documents / pending step. Errors here are
  // ignored (a brand-new applicant may legitimately have no document record).
  useEffect(() => {
    if (
      step === "form" &&
      !application &&
      documentsQuery.isSuccess &&
      documentsQuery.data.length > 0
    ) {
      setStep("documents");
    }
  }, [step, application, documentsQuery.isSuccess, documentsQuery.data]);

  const apply = useMutation({
    mutationFn: (input: ApplyAgencyInput) => AgenciesApi.apply(input),
    onSuccess: (app) => {
      setApplication(app);
      setStep("documents");
      qc.invalidateQueries({ queryKey: applyKeys.myDocuments() });
    },
  });

  const v = {
    name: name.trim(),
    description: description.trim(),
    legalName: legalName.trim(),
    taxId: taxId.trim(),
    ownerName: ownerName.trim(),
    ownerIdNumber: ownerIdNumber.trim(),
    phone: phone.trim(),
    address: address.trim(),
  };
  const ready =
    v.name.length >= 2 &&
    v.legalName.length >= 2 &&
    v.taxId.length >= 3 &&
    v.ownerName.length >= 2 &&
    v.ownerIdNumber.length >= 3 &&
    v.phone.length >= 5 &&
    v.address.length >= 5;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || apply.isPending) return;
    apply.mutate({
      name: v.name,
      description: v.description || undefined,
      legalName: v.legalName,
      taxId: v.taxId,
      ownerName: v.ownerName,
      ownerIdNumber: v.ownerIdNumber,
      phone: v.phone,
      address: v.address,
    });
  }

  const docs = documentsQuery.data ?? [];
  const requiredUploaded = REQUIRED_DOCS.every((r) =>
    docs.some((d) => d.type === r.type),
  );
  // For a returning owner (alreadyApplied) `application` is null, so fall back
  // to the status passed by the page (from the agency session).
  const effectiveStatus: AgencyVerificationStatus =
    application?.verificationStatus ?? status ?? "pending";

  // ── Step indicator ─────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: "form", label: "Your details" },
    { key: "documents", label: "Documents" },
    { key: "agreement", label: "Host agreement" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-3 text-sm">
        {steps.map((s, i) => {
          const active = s.key === step;
          const done =
            i < stepIndex || (s.key === "agreement" && agreementSigned);
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span className="flex items-center gap-2">
                <span
                  className={
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-success-soft text-success"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {done && !active ? "✓" : i + 1}
                </span>
                <span
                  className={
                    active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {s.label}
                </span>
              </span>
              {i < steps.length - 1 ? (
                <span className="h-px w-6 bg-border" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {step === "form" ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">
              Agency application
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These details are used to verify your business. Fields are
              required unless marked optional.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={submit}>
              {/* About the agency (public-facing) */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="apply-name">Agency name</Label>
                  <Input
                    id="apply-name"
                    placeholder="e.g. Cibao Rentals"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="organization"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown to renters on your storefront.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apply-description">
                    Short description (optional)
                  </Label>
                  <Textarea
                    id="apply-description"
                    placeholder="A sentence or two about your agency and where you operate."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Legal & owner details (private KYC) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="apply-legal-name">Legal name</Label>
                  <Input
                    id="apply-legal-name"
                    placeholder="Registered company name"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apply-tax-id">Tax ID (RNC / NIT)</Label>
                  <Input
                    id="apply-tax-id"
                    placeholder="e.g. 1-01-12345-6"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apply-owner-name">Owner name</Label>
                  <Input
                    id="apply-owner-name"
                    placeholder="Full legal name of the owner"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apply-owner-id">Owner ID number</Label>
                  <Input
                    id="apply-owner-id"
                    placeholder="Cédula / passport number"
                    value={ownerIdNumber}
                    onChange={(e) => setOwnerIdNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apply-phone">Phone</Label>
                  <Input
                    id="apply-phone"
                    type="tel"
                    placeholder="e.g. +1 809 555 0100"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="apply-address">Business address</Label>
                  <Input
                    id="apply-address"
                    placeholder="Street, city, province"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                  />
                </div>
              </div>

              {apply.isError ? (
                <p className="text-sm text-destructive">
                  {(apply.error as Error).message}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={!ready || apply.isPending}>
                  {apply.isPending ? "Submitting…" : "Submit application"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Next: upload your documents.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : step === "documents" ? (
        <div className="space-y-6">
          {/* Pending / status banner */}
          <Card className="border-accent-soft-foreground/15 bg-accent-soft">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg text-accent-soft-foreground">
                    Application submitted — pending review
                  </h2>
                  <p className="mt-1 text-sm text-accent-soft-foreground/80">
                    Upload the documents below to help us verify your agency
                    faster. You can add them now or come back to this page any
                    time — your progress is saved.
                  </p>
                </div>
                <StatusBadge status={effectiveStatus} />
              </div>
            </CardContent>
          </Card>

          {/* Uploaders */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">
                Required documents
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a clear photo or PDF of each.
              </p>
            </CardHeader>
            <CardContent>
              <AgencyDocumentUploader required={REQUIRED_DOCS} existing={docs} />
            </CardContent>
          </Card>

          {/* Uploaded documents list */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">
                Your documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentsQuery.isLoading ? (
                <LoadingState label="Loading documents…" className="py-8" />
              ) : documentsQuery.isError ? (
                <ErrorState
                  title="Could not load documents"
                  message={(documentsQuery.error as Error).message}
                  onRetry={() => documentsQuery.refetch()}
                />
              ) : docs.length === 0 ? (
                <EmptyState
                  title="No documents uploaded yet"
                  description="Add your business registration and owner ID above."
                  className="py-10"
                />
              ) : (
                <ul className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {d.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {agencyDocumentTypeLabel(d.type)} ·{" "}
                          {formatUploadedDate(d.uploadedAt)}
                        </p>
                      </div>
                      <Badge variant="secondary">{d.contentType}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Host agreement hand-off */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <FilePenLine className="h-4 w-4 text-primary" />
                  Host agreement
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {agreementSigned
                    ? "Signed — nothing else to do here."
                    : "Sign the platform's host agreement now so your cars can go live the moment you are verified."}
                </p>
              </div>
              {agreementSigned ? (
                <Badge variant="success">Signed</Badge>
              ) : (
                <Button onClick={() => setStep("agreement")}>
                  {requiredUploaded ? "Continue" : "Sign now"}
                </Button>
              )}
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            We&apos;ll notify you once your agency has been reviewed. Once
            verified, you&apos;ll get access to the agency dashboard to add your
            cars.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">
                Host agreement
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                The association agreement between you and the platform: what
                you commit to as a host, how bookings, deposits, cancellations
                and payouts work. Read it, type your name and sign.
              </p>
            </CardHeader>
            <CardContent>
              {agreementSigned && agreementQuery.data?.signed ? (
                <HostAgreementSignedSummary document={agreementQuery.data.signed} />
              ) : (
                <HostAgreementSigner />
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setStep("documents")}>
              Back to documents
            </Button>
            {agreementSigned ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re all set. We&apos;ll email you once your agency is
                verified — you can also check the{" "}
                <Link href="/agency" className="text-primary underline">
                  dashboard
                </Link>
                .
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
