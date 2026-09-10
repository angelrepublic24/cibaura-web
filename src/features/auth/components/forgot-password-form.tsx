"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useForgotPassword } from "@/features/auth/hooks";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/schemas";
import { getErrorMessage } from "@/shared/api/errors";
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

/**
 * "Forgot password" — asks for the email and shows the SAME confirmation
 * whether or not an account exists (the backend answers 202 either way, so
 * the form cannot be used to enumerate accounts). Guest accounts created by
 * a walk-in receive the account-claim email through the same route.
 */
export function ForgotPasswordForm() {
  const mutation = useForgotPassword();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  if (mutation.isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-success" />
            Check your inbox
          </CardTitle>
          <CardDescription>
            If an account exists for{" "}
            <span className="font-medium text-foreground">
              {form.getValues("email")}
            </span>
            , we have sent a link to reset your password. The link is valid
            for 30 minutes and can be used once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nothing arrived? Check your spam folder, or request a new link.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => mutation.reset()}
            >
              Send another link
            </Button>
            <Link
              href="/auth/login"
              className="inline-flex h-10 items-center px-3 text-sm text-primary underline-offset-2 hover:underline"
            >
              Back to log in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter the email you registered with and we will send you a reset
          link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values.email))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              autoFocus
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-red-600">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="text-sm text-red-600" role="alert">
              {getErrorMessage(
                mutation.error,
                "We could not send the email right now. Please try again in a minute.",
              )}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/auth/login" className="text-primary underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
