"use client";

import { Mail, UserCircle } from "lucide-react";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import type { Role } from "@/shared/types/domain";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

/**
 * /admin/profile — the signed-in admin's own account.
 *
 * Reads the profile from the shared `useMe()` query (falling back to the
 * already-hydrated auth store so the header renders instantly), and hosts the
 * shared change-password card (`features/auth`).
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
  const first = parts[0];
  if (first === undefined) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return ((first[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
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
          <ChangePasswordForm className="max-w-lg" />
        </>
      )}
    </div>
  );
}
