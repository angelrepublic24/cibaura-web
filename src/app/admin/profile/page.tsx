"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Mail, UserCircle } from "lucide-react";
import { AdminApi } from "@/features/admin/api";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import type { Role } from "@/shared/types/domain";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
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
 * /admin/profile — the signed-in admin's own account.
 *
 * Reads the profile from the shared `useMe()` query (falling back to the
 * already-hydrated auth store so the header renders instantly), and hosts a
 * "Change password" form that PATCHes /auth/change-password. The password
 * never touches the URL or any log; the backend re-verifies the current
 * password before writing the new hash.
 */

const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  agency_owner: "Agency owner",
  agency_staff: "Agency staff",
  platform_admin: "Platform admin",
};

/** Two-letter initials from a display name (first + last). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** ISO datetime → "Aug 5, 2026" (blank input → null). */
function fmtDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminProfilePage() {
  // `useMe()` is deduped with the guard's call (same query key); the store user
  // is already hydrated by the layout's RoleGuard, so use it as an instant
  // fallback while the query settles.
  const meQuery = useMe();
  const storeUser = useAuthStore((s) => s.user);
  const user = meQuery.data ?? storeUser;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your platform-admin account and sign-in credentials.
        </p>
      </div>

      {!user && meQuery.isLoading ? (
        <LoadingState label="Loading your profile…" />
      ) : !user ? (
        <ErrorState
          title="Could not load your profile"
          message={
            meQuery.error instanceof Error
              ? meQuery.error.message
              : "Please try again."
          }
          onRetry={() => meQuery.refetch()}
        />
      ) : (
        <>
          {/* ── Account ─────────────────────────────────────────────────── */}
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                These details come from your platform-admin account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <span className="bg-primary text-primary-foreground flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold">
                  {initials(user.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-base font-semibold text-foreground">
                    <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {user.fullName}
                  </p>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate text-sm">
                    <Mail className="h-4 w-4 shrink-0" />
                    {user.email}
                  </p>
                </div>
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="text-muted-foreground w-24 shrink-0">Roles</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {user.roles.length > 0 ? (
                      user.roles.map((r) => (
                        <Badge key={r} variant="secondary">
                          {ROLE_LABELS[r] ?? r}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                {fmtDate(user.createdAt) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="text-muted-foreground w-24 shrink-0">
                      Member since
                    </dt>
                    <dd className="text-foreground">
                      {fmtDate(user.createdAt)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {/* ── Change password ─────────────────────────────────────────── */}
          <ChangePassword />
        </>
      )}
    </div>
  );
}

/**
 * Change-password form. All validation mirrors the backend DTO (current
 * required; new 8–72 chars) plus a confirm-match and a "must differ" guard.
 * On a wrong current password the API returns 401 with a clear message and the
 * session is preserved (see AdminApi.changePassword), so the admin can retry.
 */
function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      AdminApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });

  // Reset any prior success/error banner as soon as the admin edits a field.
  const touch = () => {
    if (mutation.isSuccess || mutation.isError) mutation.reset();
  };

  const currentOk = currentPassword.length > 0;
  const lengthOk = newPassword.length >= 8 && newPassword.length <= 72;
  const differs = newPassword !== currentPassword;
  const confirmOk =
    confirmPassword.length > 0 && confirmPassword === newPassword;
  const canSubmit =
    currentOk && lengthOk && differs && confirmOk && !mutation.isPending;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Change password
        </CardTitle>
        <CardDescription>
          Enter your current password, then a new one (8–72 characters).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                touch();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                touch();
              }}
              aria-invalid={newPassword.length > 0 && !lengthOk}
            />
            {newPassword.length > 0 && !lengthOk ? (
              <p className="text-destructive text-sm">
                Password must be 8–72 characters.
              </p>
            ) : newPassword.length > 0 && !differs ? (
              <p className="text-destructive text-sm">
                New password must be different from the current one.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                touch();
              }}
              aria-invalid={confirmPassword.length > 0 && !confirmOk}
            />
            {confirmPassword.length > 0 && !confirmOk ? (
              <p className="text-destructive text-sm">
                Passwords do not match.
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="text-destructive text-sm">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Could not change your password. Please try again."}
            </p>
          ) : null}
          {mutation.isSuccess ? (
            <p className="text-success text-sm">
              Your password has been changed.
            </p>
          ) : null}

          <Button type="submit" disabled={!canSubmit}>
            {mutation.isPending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
