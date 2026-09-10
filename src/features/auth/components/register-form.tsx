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

export function RegisterForm() {
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
    mutationFn: (values: RegisterFormValues) =>
      AuthApi.register({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone || undefined,
        // The version the user actually saw/accepted — read from the server.
        termsVersion: legal.data!.termsVersion,
      }),
    onSuccess: ({ user }) => {
      // The response set the httpOnly session cookies; only the user
      // snapshot is kept client-side.
      signIn(user);
      router.push("/account");
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
            setTermsNotice(null);
            mutation.mutate(values);
          })}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Full name</Label>
            <Input id="reg-name" autoComplete="name" {...form.register("fullName")} />
            {errors.fullName ? (
              <p className="text-sm text-red-600">{errors.fullName.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-phone">Phone (optional)</Label>
            <Input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              {...form.register("phone")}
            />
            {errors.phone ? (
              <p className="text-sm text-red-600">{errors.phone.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Password</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
            {errors.password ? (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm">Confirm password</Label>
            <Input
              id="reg-confirm"
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
          <Link href="/auth/login" className="text-primary underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
