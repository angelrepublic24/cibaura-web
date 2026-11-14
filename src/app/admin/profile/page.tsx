"use client";

import { useState } from "react";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { useMe } from "@/modules/auth/hooks/auth.hook";
import { useAuthStore } from "@/shared/auth/store";
import type { Role } from "@/shared/types/domain";
import { SettingGroup, SettingRow } from "@/shared/components/setting-row";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

/**
 * /admin/profile — the signed-in admin's own account.
 *
 * Reads the profile from the shared `useMe()` query (falling back to the
 * already-hydrated auth store so the header renders instantly), and hosts the
 * shared change-password form (`modules/auth`).
 *
 * ── WHY IT LOOKS LIKE THE SETTINGS PAGE ──────────────────────────────────
 *
 * Both screens answer "what is true about this, and what can I change" — so
 * they use the same `SettingRow` idiom rather than two different shapes of
 * card. This one also dropped a `max-w-lg` that pinned both cards to 512px
 * inside a console pane three times that wide: an account page is not a
 * sign-up form, and the empty two thirds read as a page that had failed to
 * load the rest of itself.
 *
 * ── WHY THE PASSWORD FORM IS BEHIND A BUTTON ─────────────────────────────
 *
 * Three empty password boxes were the loudest thing on a page you mostly open
 * to check who you are signed in as. It is an action, so it reads as one until
 * you ask for it.
 */

const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  agency_owner: "Agency owner",
  agency_staff: "Agency staff",
  platform_admin: "Platform admin",
};

/** What the role actually grants, in the admin's own words. */
const ROLE_MEANING: Record<Role, string> = {
  customer: "Can book cars as a renter.",
  agency_owner: "Runs an agency: its fleet, bookings, branches and payouts.",
  agency_staff: "Works an agency's bookings, without its money or its staff.",
  platform_admin:
    "Governs the whole platform — every agency, booking, claim and payout.",
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

  const [changing, setChanging] = useState(false);
  const memberSince = fmtDate(user?.createdAt);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold">Your account</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your platform-admin identity and sign-in credentials.
        </p>
      </div>

      {!user && meQuery.isLoading ? (
        <LoadingState label="Loading your profile…" className="mt-8" />
      ) : !user ? (
        <ErrorState
          className="mt-8"
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
          {/* The identity band. Full width on purpose: it is the one thing on
              this page you came to confirm, and it reads in a glance. */}
          <div className="mt-6 flex flex-wrap items-center gap-5 rounded-[var(--radius)] border border-border bg-surface px-5 py-4 shadow-sm">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-lg font-bold tracking-tight text-primary-foreground">
              {initials(user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-foreground">
                {user.fullName}
              </p>
              <p className="text-muted-foreground mt-0.5 truncate text-sm">
                {user.email}
              </p>
            </div>
            {memberSince ? (
              <div className="ml-auto text-right">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Member since
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {memberSince}
                </p>
              </div>
            ) : null}
          </div>

          <SettingGroup
            title="Access"
            className="mt-8"
            description="What this account can reach. Roles are granted by another platform admin, not from here."
          >
            <SettingRow
              name="Role"
              description={
                user.roles.length > 0
                  ? user.roles.map((r) => ROLE_MEANING[r]).join(" ")
                  : "This account carries no role, so it can reach nothing."
              }
              control={
                user.roles.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {user.roles.map((r) => (
                      <Badge key={r} variant="secondary">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            <SettingRow
              name="Sign-in email"
              description="The address you sign in with. Changing it is not something this screen does."
              control={
                <span className="break-all text-sm font-semibold text-foreground sm:text-right">
                  {user.email}
                </span>
              }
            />
          </SettingGroup>

          <SettingGroup
            title="Security"
            className="mt-8"
            description="Credentials for this account."
          >
            <SettingRow
              name="Password"
              description="Between 8 and 72 characters. Changing it signs you out of every device, including this one, and you will need to log in again."
              control={
                changing ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setChanging(true)}
                  >
                    Change password
                  </Button>
                )
              }
            />
            {/* Rendered UNDER the row rather than inside its control column:
                three stacked password fields do not belong in a 14rem gutter,
                and the form carries its own heading and errors. */}
            {changing ? (
              <ChangePasswordForm className="mt-5 max-w-xl" />
            ) : null}
          </SettingGroup>
        </>
      )}
    </div>
  );
}
