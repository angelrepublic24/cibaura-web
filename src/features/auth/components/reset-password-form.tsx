"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LinkIcon, Smartphone } from "lucide-react";
import { useResetPassword } from "@/features/auth/hooks";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/schemas";
import { TermsCheckbox } from "@/features/auth/components/terms-checkbox";
import { useLegalCurrent } from "@/features/legal/hooks";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

/** Backend `ResetPasswordDto`: `@Length(64, 64)` hex token. */
const TOKEN_REGEX = /^[0-9a-f]{64}$/i;

/** Deep link the mobile app registers (`scheme: cibaura`). */
function appDeepLink(token: string): string {
  return `cibaura://reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * "Set a new password" — reached from the email link
 * (`/auth/reset-password?token=…`). Four honest states:
 *  - no/invalid token in the URL           → "This link is not valid"
 *  - 400 RESET_TOKEN_INVALID from the API  → "expired or already used"
 *  - 409 TERMS_OUTDATED                    → reload terms, ask to re-accept
 *  - success                               → "Password updated" + log in
 * Resetting also records acceptance of the current terms (the backend
 * requires it and turns a guest account into a full one).
 */
export function ResetPasswordForm({ token }: { token?: string }) {
  const legal = useLegalCurrent();
  const mutation = useResetPassword();
  const [termsNotice, setTermsNotice] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "", acceptTerms: false },
  });

  if (token === undefined || !TOKEN_REGEX.test(token)) {
    return (
      <InvalidLinkCard
        title="This link is not valid"
        description="The reset link is incomplete or malformed. Open the link from your email again, or request a new one."
      />
    );
  }

  if (mutation.isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Password updated
          </CardTitle>
          <CardDescription>
            Your new password is active and every other session has been
            signed out. Log in to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/login" className={buttonVariants({ className: "w-full" })}>
            Log in
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (
    mutation.isError &&
    isApiErrorCode(mutation.error, API_ERROR_CODES.RESET_TOKEN_INVALID)
  ) {
    return (
      <InvalidLinkCard
        title="This link has expired or was already used"
        description="Reset links work once and expire after 30 minutes. Request a new one and use it right away."
      />
    );
  }

  const errors = form.formState.errors;
  const legalReady = legal.isSuccess && !!legal.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          8–72 characters. You will be asked to log in again afterwards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => {
            const termsVersion = legal.data?.termsVersion;
            // The submit button stays disabled until the terms load.
            if (termsVersion === undefined) return;
            setTermsNotice(null);
            mutation.mutate(
              {
                token,
                password: values.password,
                termsVersion,
              },
              {
                onError: async (error) => {
                  if (isApiErrorCode(error, API_ERROR_CODES.TERMS_OUTDATED)) {
                    form.setValue("acceptTerms", false);
                    setTermsNotice(
                      "Our terms were updated. Please review and accept the current version, then submit again.",
                    );
                    await legal.refetch();
                  }
                },
              },
            );
          })}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              {...form.register("password")}
            />
            {errors.password ? (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm">Confirm new password</Label>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          <TermsCheckbox
            id="reset-terms"
            inputProps={form.register("acceptTerms")}
            disabled={!legalReady}
            error={errors.acceptTerms?.message}
            hint={
              legal.isLoading ? (
                "Loading the current terms…"
              ) : legal.isError ? (
                <>
                  The current terms could not be loaded.{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => legal.refetch()}
                  >
                    Try again
                  </button>
                </>
              ) : legal.data ? (
                `Terms version ${legal.data.termsVersion}`
              ) : null
            }
          />

          {termsNotice ? (
            <p
              className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              role="status"
            >
              {termsNotice}
            </p>
          ) : null}

          {mutation.isError &&
          !isApiErrorCode(mutation.error, API_ERROR_CODES.TERMS_OUTDATED) ? (
            <p className="text-sm text-red-600" role="alert">
              {getErrorMessage(
                mutation.error,
                "Could not update your password. Please try again.",
              )}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !legalReady}
          >
            {mutation.isPending ? "Updating…" : "Update password"}
          </Button>
        </form>

        <div className="mt-5 flex items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Using the Cibaura app?{" "}
            <a
              href={appDeepLink(token)}
              className="text-primary underline underline-offset-2"
            >
              Open this link in the app
            </a>{" "}
            to reset your password there.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function InvalidLinkCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-destructive" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link href="/auth/forgot-password" className={buttonVariants()}>
          Request a new link
        </Link>
        <Link
          href="/auth/login"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to log in
        </Link>
      </CardContent>
    </Card>
  );
}
