"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { InvitesApi, inviteKeys } from "@/features/admin/invites";
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
import { ErrorState, LoadingState } from "@/shared/components/states";
import { cn } from "@/lib/utils";

/** Set-password form schema (mirrors the register page's password rules). */
const acceptInviteSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;

/**
 * Public account-creation surface reached from an emailed invite link.
 *
 *  1. verify the `?token` -> greet with the invited email
 *  2. set a password -> POST accept -> the platform_admin user is created
 *  3. confirmation + a path to log in
 *
 * Any invalid / expired / already-used token (verify 404/410) collapses to a
 * single clear error — the page never leaks whether an email exists.
 */
export function AcceptInviteForm({ token }: { token?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const verify = useQuery({
    queryKey: inviteKeys.verify(token ?? ""),
    queryFn: () => InvitesApi.verify(token as string),
    enabled: !!token,
    retry: false,
  });

  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: AcceptInviteFormValues) =>
      InvitesApi.accept({ token: token as string, password: values.password }),
    onSuccess: () => setDone(true),
  });

  // Once the account exists, drift them over to the login page.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => router.push("/auth/login"), 4000);
    return () => clearTimeout(t);
  }, [done, router]);

  const invalid = (
    <ErrorState
      title="Invite unavailable"
      message="This invite is invalid or has expired. Ask a platform admin to send you a new one."
    />
  );

  if (!token) return invalid;
  if (verify.isPending) return <LoadingState label="Checking your invite…" />;
  if (verify.isError || !verify.data) return invalid;

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account ready</CardTitle>
          <CardDescription>
            Your platform admin account for{" "}
            <span className="font-medium text-foreground">
              {verify.data.email}
            </span>{" "}
            is set up. You can log in now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/auth/login"
            className={cn(buttonVariants(), "w-full")}
          >
            Go to log in
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Redirecting you to the login page…
          </p>
        </CardContent>
      </Card>
    );
  }

  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&rsquo;ve been invited</CardTitle>
        <CardDescription>
          Set a password to activate the platform admin account for{" "}
          <span className="font-medium text-foreground">
            {verify.data.email}
          </span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="accept-password">Password</Label>
            <div className="relative">
              <Input
                id="accept-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accept-confirm">Confirm password</Label>
            <Input
              id="accept-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="text-sm text-red-600">{mutation.error.message}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Activating…" : "Set password & activate"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already activated?{" "}
          <Link href="/auth/login" className="text-primary underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
