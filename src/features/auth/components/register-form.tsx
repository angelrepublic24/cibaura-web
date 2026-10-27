"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AuthApi } from "@/features/auth/api";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas";
import { TermsCheckbox } from "@/features/auth/components/terms-checkbox";
import { useLegalCurrent } from "@/features/legal/hooks";
import { useAuthStore } from "@/shared/auth/store";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const legal = useLegalCurrent();
  const [termsNotice, setTermsNotice] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const mutation = useMutation({
    mutationFn: ({
      values,
      // The version the user actually saw/accepted — read from the server.
      termsVersion,
    }: {
      values: RegisterFormValues;
      termsVersion: string;
    }) =>
      AuthApi.register({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone || undefined,
        termsVersion,
      }),
    onSuccess: ({ user }) => {
      // The response set the httpOnly session cookies; only the user
      // snapshot is kept client-side.
      signIn(user);
      // Honour the destination a guard preserved when the guest switched from
      // login to register; otherwise land in their account. Only follow a
      // SAME-ORIGIN internal path — reject protocol-relative ("//evil.com")
      // and backslash ("/\\evil.com") forms that would open-redirect off-site.
      // Mirrors the sanitisation in login-form.tsx.
      const safeNext = next && /^\/(?![/\\])/.test(next) ? next : "/account";
      router.push(safeNext);
    },
    onError: async (error) => {
      if (isApiErrorCode(error, API_ERROR_CODES.TERMS_OUTDATED)) {
        // The terms changed between page load and submit: reload the current
        // version and ask for a fresh consent instead of silently resending.
        form.setValue("acceptTerms", false, { shouldValidate: false });
        setTermsNotice(
          "Our terms were updated while you were on this page. Please review and accept the current version to continue.",
        );
        await legal.refetch();
      }
    },
  });

  const errors = form.formState.errors;
  const legalReady = legal.isSuccess && !!legal.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Book cars from local agencies in minutes.
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
            mutation.mutate({ values, termsVersion });
          })}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Full name</Label>
            <Input
              id="reg-name"
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "reg-name-error" : undefined}
              {...form.register("fullName")}
            />
            {errors.fullName ? (
              <p id="reg-name-error" className="text-sm text-red-600" role="alert">
                {errors.fullName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "reg-email-error" : undefined}
              {...form.register("email")}
            />
            {errors.email ? (
              <p id="reg-email-error" className="text-sm text-red-600" role="alert">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-phone">Phone (optional)</Label>
            <Input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "reg-phone-error" : undefined}
              {...form.register("phone")}
            />
            {errors.phone ? (
              <p id="reg-phone-error" className="text-sm text-red-600" role="alert">
                {errors.phone.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Password</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "reg-password-error" : undefined}
              {...form.register("password")}
            />
            {errors.password ? (
              <p id="reg-password-error" className="text-sm text-red-600" role="alert">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm">Confirm password</Label>
            <Input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? "reg-confirm-error" : undefined
              }
              {...form.register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p id="reg-confirm-error" className="text-sm text-red-600" role="alert">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          <TermsCheckbox
            id="reg-terms"
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
                "Could not create your account. Please try again.",
              )}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !legalReady}
          >
            {mutation.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link
            href={
              next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"
            }
            className="text-primary underline"
          >
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
