"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import { UserMenu } from "@/shared/components/user-menu";
import { NotificationBell } from "@/shared/components/notification-bell";
import { Logo } from "@/shared/components/logo";
import { cn } from "@/lib/utils";

/**
 * Global header: brand + session-aware actions. Authenticated users get the
 * avatar account menu (which holds the agency⇄customer switch, settings links
 * and log out); guests get log in / sign up. Role links are convenience only —
 * the real gate is the RoleGuard + backend RBAC.
 */
export function SiteHeader() {
  useMe(); // hydrate session on every page
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hasRole = useAuthStore((s) => s.hasRole);

  const linkCls =
    "rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  const isAgency = hasRole("agency_owner", "agency_staff");
  const inAgency = pathname.startsWith("/agency");
  // Agency people live in the agency ecosystem — their "home" is the workspace.
  const homeHref = isAgency ? "/agency" : "/";

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

        <nav className="flex items-center gap-1">
          {status === "authenticated" && user ? (
            <>
              {!inAgency ? (
                <Link
                  href="/agencies"
                  className={cn(linkCls, "hidden sm:inline-flex")}
                >
                  Agencies
                </Link>
              ) : null}
              <div className="flex items-center gap-2">
                <NotificationBell />
                <UserMenu />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/agencies"
                className={cn(linkCls, "hidden sm:inline-flex")}
              >
                Agencies
              </Link>
              <Link href="/auth/login" className={linkCls}>
                Log in
              </Link>
              <Link
                href="/auth/register"
                className="ml-1 inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
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
