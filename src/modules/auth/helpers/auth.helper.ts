import type { User } from "@/shared/types/domain";
import type { AuthUserWire } from "@/modules/auth/types/auth.types";

/**
 * Pure auth helpers (mappers, routing, guards). No API or service calls here.
 */

/**
 * Map the backend user (`name`) onto the web `User` (`fullName`). The wire
 * carries `name` in both directions; the type fork stays local to the client.
 * Nullable wire fields collapse to the web shape (`phone`/`agencyId` →
 * `undefined`, `termsVersion` → `null`, missing `createdAt` → `""`).
 */
export function toUser(u: AuthUserWire): User {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone ?? undefined,
    fullName: u.name,
    roles: u.roles,
    agencyId: u.agencyId ?? undefined,
    status: u.status,
    termsVersion: u.termsVersion ?? null,
    createdAt: u.createdAt ?? "",
  };
}

/**
 * The home surface for a signed-in user: agency owners/staff land in the
 * agency workspace, platform admins in the admin console, everyone else in
 * their customer account. Shared by the login flow and the
 * redirect-if-authenticated guard on the public auth screens so the routing
 * lives in exactly one place.
 */
export function roleHome(user: User): string {
  if (
    user.roles.includes("agency_owner") ||
    user.roles.includes("agency_staff")
  ) {
    return "/agency";
  }
  if (user.roles.includes("platform_admin")) {
    return "/admin";
  }
  return "/account";
}

/**
 * A post-auth redirect target that is safe to follow. Only a SAME-ORIGIN
 * internal path passes; protocol-relative (`//evil.com`) and backslash
 * (`/\evil.com`, which browsers normalise to `//`) forms are rejected so a
 * crafted `?next=` can never open-redirect off-site after login/register.
 * Anything unsafe (or absent) falls back to the caller's `fallback`.
 */
export function safeInternalPath(
  next: string | undefined,
  fallback: string,
): string {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback;
}
