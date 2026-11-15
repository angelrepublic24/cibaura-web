"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilePenLine } from "lucide-react";
import type {
  RentalAgreementPreview,
  SignatureInput,
  SignRentalAgreementFormValues,
} from "@/modules/bookings/types/bookings.types";
import type { CheckoutSnapshot } from "@/modules/bookings/helpers/checkout-consent";
import { unexpired } from "@/modules/bookings/helpers/checkout-consent";
import { useAgreementPreview } from "@/modules/bookings/hooks/bookings.hook";
import {
  TYPED_NAME_MAX,
  signRentalAgreementSchema,
} from "@/modules/bookings/schema/bookings.schema";
import { ContractHtml } from "@/modules/legal/components/contract-html";
import { useAuthStore } from "@/shared/auth/store";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import { PriceBreakdown } from "@/shared/components/price-breakdown";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";

export interface SignStepError {
  message: string;
  action?: { label: string; href: string };
}

/** Form lifetime is one exact preview receipt; replacement unmounts all consent. */
function AgreementConsentForm({
  preview,
  isCurrent,
  onInvalidated,
  onSign,
  signing,
  error,
}: {
  preview: RentalAgreementPreview;
  isCurrent: () => boolean;
  onInvalidated: (message: string) => void;
  onSign: (signature: SignatureInput, preview: RentalAgreementPreview) => void;
  signing: boolean;
  error: SignStepError | null;
}) {
  const fullName = useAuthStore((state) => state.user?.fullName ?? "");
  const form = useForm<SignRentalAgreementFormValues>({
    resolver: zodResolver(signRentalAgreementSchema),
    defaultValues: { typedName: "", acceptAgreement: false },
  });
  const errors = form.formState.errors;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (!isCurrent()) {
          onInvalidated(
            "Your agreement changed or expired. Review a fresh quote and agreement before signing again.",
          );
          return;
        }
        onSign({ typedName: values.typedName }, preview);
      })}
      className="space-y-4 rounded-[var(--radius-sm)] border border-border p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ra-typed-name">Type your full legal name</Label>
        <Input
          id="ra-typed-name"
          placeholder={fullName || "Your full legal name"}
          autoComplete="name"
          maxLength={TYPED_NAME_MAX}
          aria-invalid={!!errors.typedName}
          disabled={signing || !isCurrent()}
          {...form.register("typedName")}
        />
        {errors.typedName ? (
          <p className="text-sm text-destructive">{errors.typedName.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Your typed name is your electronic signature. We also record the
            date, time, IP address and browser used to sign.
          </p>
        )}
      </div>
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          aria-invalid={!!errors.acceptAgreement}
          disabled={signing || !isCurrent()}
          {...form.register("acceptAgreement")}
        />
        <span>
          I have read the rental agreement above and agree to be bound by it,
          together with the{" "}
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
      {errors.acceptAgreement && (
        <p className="text-sm text-destructive">
          {errors.acceptAgreement.message}
        </p>
      )}
      {error && (
        <div
          className="space-y-1 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3"
          role="alert"
        >
          <p className="text-sm text-red-700">{error.message}</p>
          {error.action && (
            <Link
              href={error.action.href}
              className="inline-flex text-sm font-medium text-red-800 underline underline-offset-2"
            >
              {error.action.label}
            </Link>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={signing || !isCurrent()}>
          <FilePenLine className="h-4 w-4" />
          {signing ? "Signing and sending…" : "Sign and send request"}
        </Button>
      </div>
    </form>
  );
}

export function RentalAgreementSignDialog({
  snapshot,
  onClose,
  onInvalidated,
  isCheckoutCurrent,
  agencyName,
  carLabel,
  onSign,
  signing,
  error,
}: {
  snapshot: CheckoutSnapshot;
  onClose: () => void;
  onInvalidated: (message: string) => void;
  isCheckoutCurrent: () => boolean;
  agencyName: string;
  carLabel: string;
  onSign: (signature: SignatureInput, preview: RentalAgreementPreview) => void;
  signing: boolean;
  error: SignStepError | null;
}) {
  const preview = useAgreementPreview(
    {
      ...snapshot.input,
      quoteToken: snapshot.quote.token,
      termsVersion: snapshot.termsVersion,
    },
    snapshot.userId,
    true,
  );
  const template = preview.isSuccess ? preview.data : undefined;
  const identity = template
    ? JSON.stringify([
        template.kind,
        template.version,
        template.title,
        template.html,
        template.agreementConsentToken,
        template.consentExpiresAt,
      ])
    : null;
  const [reviewedIdentity, setReviewedIdentity] = useState<string | null>(null);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const invalidateRef = useRef(onInvalidated);
  invalidateRef.current = onInvalidated;
  useEffect(() => {
    if (!identity) return;
    if (reviewedIdentity && reviewedIdentity !== identity) {
      invalidateRef.current(
        "The agreement changed. Review a fresh quote and agreement, then sign again.",
      );
      return;
    }
    if (!reviewedIdentity) setReviewedIdentity(identity);
  }, [identity, reviewedIdentity]);
  useEffect(() => {
    if (!template) return;
    const expiry = Math.min(
      Date.parse(template.consentExpiresAt),
      Date.parse(snapshot.quote.expiresAt),
    );
    const timer = setTimeout(
      () =>
        invalidateRef.current(
          "Your agreement expired. Review a fresh quote and agreement before signing again.",
        ),
      Math.max(0, expiry - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [template, snapshot]);
  useEffect(() => {
    if (!preview.isError) return;
    const code = getApiErrorCode(preview.error);
    if (
      [
        API_ERROR_CODES.QUOTE_CONFIRMATION_REQUIRED,
        API_ERROR_CODES.AGREEMENT_CONFIRMATION_REQUIRED,
        API_ERROR_CODES.TERMS_OUTDATED,
      ].some((value) => value === code)
    ) {
      invalidateRef.current(
        "The quote, terms or agreement changed. Review the refreshed quote and accept again.",
      );
    }
  }, [preview.isError, preview.error]);
  const ready = Boolean(
    template &&
      identity &&
      reviewedIdentity === identity &&
      unexpired(template.consentExpiresAt) &&
      unexpired(snapshot.quote.expiresAt),
  );
  return (
    <Dialog
      open
      onClose={() => {
        if (!signing) onClose();
      }}
      title="Review and sign the rental agreement"
      description={`${carLabel} · ${agencyName}`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <PriceBreakdown
            pricing={snapshot.quote.pricing}
            viewer="renter"
            deposit={{
              cents: snapshot.quote.depositCents,
              required: snapshot.quote.depositRequired,
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Selected card: {snapshot.card.brand} •••• {snapshot.card.last4}.
            Terms version: {snapshot.termsVersion}.
          </p>
        </div>
        {preview.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : preview.isError ? (
          <div
            className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <p className="text-sm text-red-700">
              {getErrorMessage(
                preview.error,
                "The agreement could not be prepared. Please try again.",
              )}
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
              <h3 className="font-semibold">{template.title}</h3>
              <span className="text-xs text-muted-foreground">
                Version {template.version}
              </span>
            </div>
            <ContractHtml html={template.html} className="max-h-[22rem]" />
            <p className="mt-2 text-xs text-muted-foreground">
              This agreement and its quoted amounts are the ones you are
              reviewing. A signed copy is stored with your booking; {agencyName}{" "}
              countersigns when they accept.
            </p>
          </div>
        ) : null}
        {ready && template && (
          <AgreementConsentForm
            key={reviewedIdentity}
            preview={template}
            isCurrent={() =>
              isCheckoutCurrent() &&
              currentIdentity.current === reviewedIdentity &&
              unexpired(template.consentExpiresAt) &&
              unexpired(snapshot.quote.expiresAt)
            }
            onInvalidated={onInvalidated}
            onSign={onSign}
            signing={signing || preview.isFetching}
            error={error}
          />
        )}
        <div className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            disabled={signing}
            onClick={onClose}
          >
            Back
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
