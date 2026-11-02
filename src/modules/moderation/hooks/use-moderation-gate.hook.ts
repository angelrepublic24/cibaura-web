"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { rolesCanModerate } from "@/modules/moderation/helpers/moderation.helper";
import { useAuthStore } from "@/shared/auth/store";

/**
 * TRUE when the SIGNED-IN viewer holds a role the moderation API serves —
 * the question `/account/blocked`'s nav row asks, since `GET /blocks` answers
 * 403 for anybody else. FALSE for a guest: there is no session to serve.
 *
 * An entry point that is deliberately visible to guests wants
 * {@link useModerationGate} instead, which keeps the control up for a visitor
 * with no session and hides it only for one the API would refuse.
 */
export function useHasModerationRole(): boolean {
  const roles = useAuthStore((s) => s.user?.roles);
  return rolesCanModerate(roles);
}

export interface ModerationGate {
  /**
   * Whether this control should be RENDERED AT ALL.
   *
   * True for a guest and while the session is still resolving — see `gate`.
   * False only for a resolved session the moderation API refuses, which today
   * means a platform_admin: they read the queue at `/admin/reports` and
   * `POST /reports` / `POST /blocks` do not serve their role. Showing them a
   * flag button would open a dialog whose reason list 403s and whose submit
   * could never succeed.
   */
  canModerate: boolean;
  /**
   * Run the action, or send a guest to log in and back. Never a no-op: a
   * viewer who cannot moderate has had the control hidden by `canModerate`,
   * so nothing calls this on their behalf.
   */
  gate: (action: () => void) => void;
}

/**
 * SESSION GATE for the moderation entry points that guests can see.
 *
 * Reporting and blocking both need a session, but the buttons stay VISIBLE to
 * guests: a car listing or a storefront with no way to report it reads as a
 * platform with no moderation at all. Pressing one sends the guest to log in
 * and brings them back to the page they were on — the idiom already used by
 * the booking panel in `modules/cars/components/car-detail.tsx`.
 *
 * "Signed in" is NOT the same question as "may moderate", which is why this
 * returns two things. The backend's `ModerationController` is
 * `@Auth(customer, agency_owner, agency_staff)` on every route, so a signed-in
 * platform_admin is refused everywhere here; `canModerate` is what keeps the
 * UI from offering them a door that is locked.
 *
 * Usage: `const { canModerate, gate } = useModerationGate();` — return null
 * when `!canModerate`, and wrap the opener in `gate(() => setOpen(true))`.
 * Lives in `hooks/` rather than beside the buttons because it is a hook, even
 * though it owns navigation rather than a query.
 */
export function useModerationGate(): ModerationGate {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const hasRole = useHasModerationRole();

  const gate = useCallback(
    (action: () => void) => {
      if (status === "authenticated") {
        action();
        return;
      }
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.push(`/auth/login?next=${encodeURIComponent(next)}`);
    },
    [router, status],
  );

  return {
    // `unknown` and `guest` both keep the control up: one is a session still
    // in flight (hiding and re-showing it would flicker on every page) and
    // the other is the visitor the gate exists for.
    canModerate: status !== "authenticated" || hasRole,
    gate,
  };
}
