"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilePenLine } from "lucide-react";
import type { QuoteInput, SignatureInput } from "@/features/bookings/api";
import { useAgreementPreview } from "@/features/bookings/hooks";
import {
  TYPED_NAME_MAX,
  signRentalAgreementSchema,
  type SignRentalAgreementFormValues,
} from "@/features/bookings/schemas";
import { ContractHtml } from "@/features/legal/components/contract-html";
import { useAuthStore } from "@/shared/auth/store";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";

/** What the caller's request mutation reported, already mapped to copy. */
export interface SignStepError {
  message: string;
  action?: { label: string; href: string };
}

/** Copy for the preview-time codes (spec §0.2); anything else → server message. */
function describePreviewError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.TEMPLATE_NOT_PUBLISHED:
      return "The rental agreement is not available right now, so new requests are paused. Please try again later.";
    case API_ERROR_CODES.CUSTOMER_NOT_VERIFIED:
      return "Your identity is not verified yet — complete the one-time verification to book.";
    default:
      return getErrorMessage(
        error,
        "The agreement could not be prepared. Please try again.",
      );
  }
}

/**
 * "Review and sign the rental agreement" — the step between the server
 * quote and `POST /bookings` (ADR-0010). Fetches the agreement rendered
 * with the REAL quote/customer/car/host variables
 * (`POST /bookings/agreement-preview`), shows it verbatim, and collects the
 * click-to-sign evidence: typed full name + explicit checkbox (the server
 * adds IP, user agent and time). The caller owns the request mutation:
 * `onSign` receives the signature and the dialog shows `error` while
 * `signing` is false again.
 */
export function RentalAgreementSignDialog({
  open,
  onClose,
  quoteInput,
  agencyName,
  carLabel,
  onSign,
  signing,
  error,
}: {
  open: boolean;
  onClose: () => void;
  quoteInput: QuoteInput;
  agencyName: string;
  carLabel: string;
  onSign: (signature: SignatureInput) => void;
  signing: boolean;
  error: SignStepError | null;
}) {
  const fullName = useAuthStore((s) => s.user?.fullName ?? "");
  const preview = useAgreementPreview(quoteInput, open);

  const form = useForm<SignRentalAgreementFormValues>({
    resolver: zodResolver(signRentalAgreementSchema),
    defaultValues: { typedName: fullName, acceptAgreement: false },
  });
  const errors = form.formState.errors;
  const typedNameTouched = !!form.formState.dirtyFields.typedName;

  // The session store may hydrate after this form mounted — seed the name
  // once it lands, unless the customer already typed something.
  useEffect(() => {
    if (!typedNameTouched) form.setValue("typedName", fullName);
  }, [fullName, typedNameTouched, form]);

  function close() {
    if (signing) return;
    form.reset({ typedName: fullName, acceptAgreement: false });
    onClose();
  }

  const template = preview.data;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Review and sign the rental agreement"
      description={`${carLabel} · ${agencyName}`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {preview.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : preview.isError ? (
          <div
            className="space-y-2 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <p className="text-sm text-red-700">
              {describePreviewError(preview.error)}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => preview.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : template ? (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-foreground">{template.title}</h3>
              <span className="text-xs text-muted-foreground">
                Version {template.version}
              </span>
            </div>
            {/* Rendered by the server from the published template with your
                quote, identity, the car and the host filled in — this exact
                text is what gets signed and stored as HTML + PDF. */}
            <ContractHtml html={template.html} className="max-h-[22rem]" />
            <p className="mt-2 text-xs text-muted-foreground">
              This is the exact text you are signing. A copy (HTML and PDF)
              is stored with your booking; {agencyName} countersigns it when
              they accept your request.
            </p>
          </div>
        ) : null}

        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            onSign({ typedName: values.typedName }),
          )}
          className="space-y-4 rounded-[var(--radius-sm)] border border-border p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="ra-typed-name">Type your full legal name</Label>
            <Input
              id="ra-typed-name"
              autoComplete="name"
              maxLength={TYPED_NAME_MAX}
              aria-invalid={!!errors.typedName}
              disabled={signing || !template}
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
              aria-invalid={!!errors.acceptAgreement}
              disabled={signing || !template}
              {...form.register("acceptAgreement")}
            />
            <span>
              I have read the rental agreement above and agree to be bound by
              it, together with the{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Terms of Service
              </Link>
              .
            </span>
          </label>
          {errors.acceptAgreement ? (
            <p className="text-sm text-destructive">
              {errors.acceptAgreement.message}
            </p>
          ) : null}

          {error ? (
            <div
              className="space-y-1 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3"
              role="alert"
            >
              <p className="text-sm text-red-700">{error.message}</p>
              {error.action ? (
                <Link
                  href={error.action.href}
                  className="inline-flex text-sm font-medium text-red-800 underline underline-offset-2"
                >
                  {error.action.label}
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={signing}
            >
              Back
            </Button>
            <Button type="submit" disabled={signing || !template}>
              <FilePenLine className="h-4 w-4" />
              {signing ? "Signing and sending…" : "Sign and send request"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
