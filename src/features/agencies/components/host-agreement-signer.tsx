"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, FilePenLine } from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import { acceptTermsSchema } from "@/features/auth/schemas";
import { useAuthStore } from "@/shared/auth/store";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type {
  ContractDocumentDto,
  HostAgreementStatusDto,
} from "@/shared/types/domain";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";

/** Backend `SignContractDto`: typedName 2..160, acceptTerms must be true. */
const TYPED_NAME_MIN = 2;
const TYPED_NAME_MAX = 160;

const signSchema = z.object({
  typedName: z
    .string()
    .trim()
    .min(TYPED_NAME_MIN, "Type your full legal name")
    .max(TYPED_NAME_MAX, `At most ${TYPED_NAME_MAX} characters`),
  acceptTerms: acceptTermsSchema,
});
type SignFormValues = z.infer<typeof signSchema>;

/** Minimal readable styling for the server-rendered agreement HTML. */
const AGREEMENT_HTML_CLASS =
  "max-h-[28rem] overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-muted/40 p-5 text-sm leading-relaxed text-foreground [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:my-4 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-left";

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

/** Copy for the sign-time backend codes (spec §0.2); anything else → server message. */
function describeSignError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.OWNER_ONLY:
      return "Only the agency owner can sign the host agreement.";
    case API_ERROR_CODES.HOST_AGREEMENT_OUTDATED:
      return "The agreement was updated while you were reading it. The latest version is shown below — please read it and sign again.";
    case API_ERROR_CODES.TEMPLATE_NOT_PUBLISHED:
      return "The host agreement is not available yet. Please try again later.";
    case API_ERROR_CODES.SIGNATURE_REQUIRED:
      return "Type your full name and tick the box to sign.";
    default:
      return getErrorMessage(error, "Could not record your signature.");
  }
}

/**
 * The host's own signed document, summarized. Shown by the signer once the
 * signature exists and by the settings card.
 */
export function HostAgreementSignedSummary({
  document,
}: {
  document: ContractDocumentDto;
}) {
  const signature = document.signatures.find((s) => s.role === "host");
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-success/30 bg-success-soft p-4 text-sm">
      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
      <div>
        <p className="font-medium text-success">
          Host agreement signed (version {document.templateVersion})
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {signature
            ? `Signed by ${signature.typedName} on ${fmtDateTime(signature.signedAt)}.`
            : `Signed on ${fmtDateTime(document.createdAt)}.`}
        </p>
      </div>
    </div>
  );
}

/**
 * Click-to-sign the host association agreement (ADR-0010). Reads
 * `GET /agency/host-agreement`, shows the current version rendered with the
 * host's variables, and records the signature (typed full name + checkbox;
 * the server adds IP, user agent and time) against exactly the version that
 * was read — a newer publish in between answers HOST_AGREEMENT_OUTDATED and
 * the pane refreshes. Owner-only: staff see an explanation instead of the
 * form. When a valid signature already exists (and no re-sign is required)
 * it renders the signed summary.
 */
export function HostAgreementSigner({
  onSigned,
  className,
}: {
  onSigned?: (document: ContractDocumentDto) => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const { role, isPending: roleLoading } = usePermission();
  const fullName = useAuthStore((s) => s.user?.fullName ?? "");

  const query = useQuery({
    queryKey: agencyKeys.hostAgreement(),
    queryFn: AgencyApi.hostAgreement,
  });

  const form = useForm<SignFormValues>({
    resolver: zodResolver(signSchema),
    defaultValues: { typedName: fullName, acceptTerms: false },
  });
  const errors = form.formState.errors;
  const typedNameTouched = !!form.formState.dirtyFields.typedName;

  // The session store may hydrate after this form mounted — seed the name
  // once it lands, unless the signer already typed something.
  useEffect(() => {
    if (!typedNameTouched) form.setValue("typedName", fullName);
  }, [fullName, typedNameTouched, form]);

  const sign = useMutation({
    mutationFn: (input: { typedName: string; templateVersion: number }) =>
      AgencyApi.signHostAgreement({ ...input, acceptTerms: true }),
    onSuccess: (document) => {
      qc.setQueryData<HostAgreementStatusDto>(
        agencyKeys.hostAgreement(),
        (prev) =>
          prev ? { ...prev, signed: document, resignRequired: false } : prev,
      );
      // `hostAgreementSigned` on the session drives nav banners + car activation.
      qc.invalidateQueries({ queryKey: agencyKeys.session() });
      form.reset({ typedName: fullName, acceptTerms: false });
      onSigned?.(document);
    },
    onError: (error) => {
      if (
        getApiErrorCode(error) === API_ERROR_CODES.HOST_AGREEMENT_OUTDATED
      ) {
        // Show the newly published text; the user must read + sign again.
        form.setValue("acceptTerms", false);
        void query.refetch();
      }
    },
  });

  if (query.isLoading) {
    return <LoadingState label="Loading the host agreement…" className={className} />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load the host agreement"
        message={getErrorMessage(query.error, "Please try again.")}
        onRetry={() => query.refetch()}
        className={className}
      />
    );
  }

  const status = query.data!;
  const { current } = status;
  const mustSign = !status.signed || status.resignRequired;

  if (!mustSign) {
    return (
      <div className={className}>
        <HostAgreementSignedSummary document={status.signed!} />
      </div>
    );
  }

  const isOwner = role === "owner";

  return (
    <div className={cn("space-y-4", className)}>
      {status.resignRequired && status.signed ? (
        <p
          className="rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft p-3 text-sm text-warning"
          role="status"
        >
          You signed version {status.signed.templateVersion}. Version{" "}
          {current.version} is now in force and requires a new signature —
          your listings stay live meanwhile.
        </p>
      ) : null}

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-foreground">{current.title}</h3>
          <span className="text-xs text-muted-foreground">
            Version {current.version}
          </span>
        </div>
        {/* Server-rendered from Markdown with variables substituted and HTML
            escaped (ADR-0010) — the client shows it verbatim. */}
        <div
          className={AGREEMENT_HTML_CLASS}
          dangerouslySetInnerHTML={{ __html: current.html }}
        />
      </div>

      {roleLoading ? (
        <LoadingState label="Checking who can sign…" className="py-4" />
      ) : !isOwner ? (
        <p className="text-sm text-muted-foreground" role="status">
          Only the agency owner can sign this agreement. Ask them to sign it
          from Settings.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            sign.mutate({
              typedName: values.typedName,
              templateVersion: current.version,
            }),
          )}
          className="space-y-4 rounded-[var(--radius-sm)] border border-border p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="ha-typed-name">Type your full legal name</Label>
            <Input
              id="ha-typed-name"
              autoComplete="name"
              maxLength={TYPED_NAME_MAX}
              aria-invalid={!!errors.typedName}
              disabled={sign.isPending}
              {...form.register("typedName")}
            />
            {errors.typedName ? (
              <p className="text-sm text-destructive">
                {errors.typedName.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Your typed name is your electronic signature. We also record
                the date, time, IP address and browser used to sign.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              aria-invalid={!!errors.acceptTerms}
              disabled={sign.isPending}
              {...form.register("acceptTerms")}
            />
            <span>
              I have read the host agreement above and agree to be bound by
              it.
            </span>
          </label>
          {errors.acceptTerms ? (
            <p className="text-sm text-destructive">
              Tick the box to confirm you agree.
            </p>
          ) : null}

          {sign.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {describeSignError(sign.error)}
            </p>
          ) : null}

          <Button type="submit" disabled={sign.isPending}>
            <FilePenLine className="h-4 w-4" />
            {sign.isPending ? "Signing…" : "Sign the agreement"}
          </Button>
        </form>
      )}
    </div>
  );
}
