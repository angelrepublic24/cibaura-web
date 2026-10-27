"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AuthApi } from "@/features/auth/api";
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas";
import { roleHome } from "@/features/auth/role-home";
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

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: AuthApi.login,
    onSuccess: ({ user }) => {
      // The response set the httpOnly session cookies; only the user
      // snapshot is kept client-side.
      signIn(user);
      // An explicit ?next wins; otherwise land people in THEIR ecosystem —
      // agency owners/staff go straight to the agency workspace, admins to
      // the admin console, everyone else to their customer account.
      //
      // KEPT for a PENDING applicant on purpose: `/agency` is no longer "the
      // dashboard", it is whichever of the three states the account is in, so
      // an applicant lands exactly on their application status — which is what
      // they log in to check. A rejected owner lands on the verdict + its
      // reason, which now carries its own way back to the storefront.
      // Branching on verification status here is the alternative, and it is
      // worse: the login response carries roles only, so it would mean hanging
      // an agency read (and its failure modes) off the auth path to choose
      // between two screens that both explain themselves.
      const home = roleHome(user);
      // Only follow a SAME-ORIGIN internal path. Reject protocol-relative
      // ("//evil.com") and backslash ("/\\evil.com", which browsers normalize
      // to "//") forms that would open-redirect off-site after login.
      const safeNext = next && /^\/(?![/\\])/.test(next) ? next : home;
      router.push(safeNext);
    },
  });

  const errorMessage = mutation.isError
    ? isApiErrorCode(mutation.error, API_ERROR_CODES.USER_SUSPENDED)
      ? "This account has been suspended. Contact support if you believe this is a mistake."
      : getErrorMessage(mutation.error, "Could not log in. Please try again.")
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Log in to manage your bookings.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!form.formState.errors.email}
              aria-describedby={
                form.formState.errors.email ? "login-email-error" : undefined
              }
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p id="login-email-error" className="text-sm text-red-600" role="alert">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={
                form.formState.errors.password
                  ? "login-password-error"
                  : undefined
              }
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p id="login-password-error" className="text-sm text-red-600" role="alert">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link
            href={
              next
                ? `/auth/register?next=${encodeURIComponent(next)}`
                : "/auth/register"
            }
            className="text-primary underline"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
