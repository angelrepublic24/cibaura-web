"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import { UserMenu } from "@/shared/components/user-menu";
import { NotificationBell } from "@/shared/components/notification-bell";
import { Logo } from "@/shared/components/logo";
import {
  AGENCY_SIGNUP_PATH,
  HOST_SIGNUP_LABEL,
  HOST_SIGNUP_PATH,
} from "@/shared/config/supply";

/**
 * Global header: brand + session-aware actions. Authenticated users get the
 * avatar account menu (which holds the agency⇄customer switch, settings links
 * and log out); guests get log in / sign up. Role links are convenience only —
 * the real gate is the RoleGuard + backend RBAC.
 *
 * SUPPLY DOOR: the marketplace is two-sided but the public site only speaks to
 * demand, and the host funnel used to live in the footer alone. It now sits
 * here on EVERY page, in the muted `linkCls` treatment so it stays clearly
 * secondary to the search (the real primary action) and to the Sign up button.
 *
 * Below `sm` it collapses to its icon. Measured at 360px: the wordmark is
 * ~130px and the guest actions ~140px, which leaves no room for a third
 * label. The alternatives were dropping the Sign up button on phones — a
 * demand CTA this change has no business removing — or leaving the funnel in
 * the footer on mobile, which is the problem being fixed. The link keeps its
 * accessible name, and the full invitation is two scrolls away in the footer
 * and on the homepage band.
 */
export function SiteHeader() {
  useMe(); // hydrate session on every page
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hasRole = useAuthStore((s) => s.hasRole);
  const pathname = usePathname();

  const linkCls =
    "rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  const isAgency = hasRole("agency_owner", "agency_staff");
  // Agency people live in the agency ecosystem — their "home" is the workspace.
  const homeHref = isAgency ? "/agency" : "/";
  // Someone who already supplies cars has no use for the funnel, and neither
  // does a visitor already standing in it (same rule as the footer column).
  const showHostLink =
    !isAgency &&
    pathname !== HOST_SIGNUP_PATH &&
    pathname !== AGENCY_SIGNUP_PATH;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href={homeHref}
          aria-label="Cibaura — home"
          className="flex items-center"
        >
          <Logo priority />
        </Link>

        <nav className="flex min-w-0 items-center gap-1">
          {showHostLink ? (
            <Link
              href={HOST_SIGNUP_PATH}
              className={`${linkCls} inline-flex items-center gap-1.5 whitespace-nowrap px-2 sm:px-3`}
            >
              <KeyRound className="h-4 w-4 sm:hidden" />
              <span className="sr-only sm:not-sr-only">
                {HOST_SIGNUP_LABEL}
              </span>
            </Link>
          ) : null}
          {status === "authenticated" && user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <UserMenu />
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className={`${linkCls} whitespace-nowrap px-2 sm:px-3`}
              >
                Log in
              </Link>
              <Link
                href="/auth/register"
                className="ml-1 inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover sm:px-4"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
