"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useChangePassword } from "@/features/auth/hooks";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/features/auth/schemas";
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
import { cn } from "@/lib/utils";

/**
 * Change-password card shared by every profile surface (customer, agency,
 * admin). Validation mirrors the backend DTO (current required; new 8–72
 * chars) plus confirm-match and a "must differ" guard. A wrong current
 * password comes back as 401 `PASSWORD_INCORRECT` with the session
 * preserved (the axios client never refresh-retries a coded 401, nor
 * `/auth/change-password` at all) and lands on the field itself; any other
 * failure shows the generic banner. Other sessions are revoked server-side
 * on success.
 */
export function ChangePasswordForm({ className }: { className?: string }) {
  const mutation = useChangePassword();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const errors = form.formState.errors;

  const wrongCurrentPassword =
    mutation.isError &&
    isApiErrorCode(mutation.error, API_ERROR_CODES.PASSWORD_INCORRECT);

  return (
    <Card className={cn("max-w-lg", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Change password
        </CardTitle>
        <CardDescription>
          Enter your current password, then a new one (8–72 characters). Other
          devices will be signed out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate(
              {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
              },
              {
                onSuccess: () => form.reset(),
                onError: (error) => {
                  if (
                    isApiErrorCode(error, API_ERROR_CODES.PASSWORD_INCORRECT)
                  ) {
                    form.setError("currentPassword", {
                      type: "server",
                      message: "That password is not correct.",
                    });
                    form.setFocus("currentPassword");
                  }
                },
              },
            ),
          )}
          onChange={() => {
            // Any edit clears the previous success/error banner.
            if (mutation.isSuccess || mutation.isError) mutation.reset();
          }}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              {...form.register("currentPassword")}
            />
            {errors.currentPassword ? (
              <p className="text-sm text-destructive">
                {errors.currentPassword.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...form.register("newPassword")}
            />
            {errors.newPassword ? (
              <p className="text-sm text-destructive">
                {errors.newPassword.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...form.register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          {/* The wrong-password case is shown on the field above, not here. */}
          {mutation.isError && !wrongCurrentPassword ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                mutation.error,
                "Could not change your password. Please try again.",
              )}
            </p>
          ) : null}
          {mutation.isSuccess ? (
            <p className="text-sm text-success" role="status">
              Your password has been changed.
            </p>
          ) : null}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
