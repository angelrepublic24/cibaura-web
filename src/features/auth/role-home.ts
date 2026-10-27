import type { User } from "@/shared/types/domain";

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
