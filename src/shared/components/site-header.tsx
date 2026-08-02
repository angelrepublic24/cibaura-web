"use client";

import Link from "next/link";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import { Button } from "@/shared/components/ui/button";
import { Logo } from "@/shared/components/logo";

/**
 * Global header: brand, primary nav and session-aware actions.
 * Role links are convenience only — the real gate is the RoleGuard +
 * backend RBAC.
 */
export function SiteHeader() {
  useMe(); // hydrate session on every page
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hasRole = useAuthStore((s) => s.hasRole);
  const signOut = useAuthStore((s) => s.signOut);

  const linkCls =
    "rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Cibaura — home" className="flex items-center">
          <Logo priority />
        </Link>

        <nav className="flex items-center gap-1">
          {status === "authenticated" && user ? (
            <>
              <Link href="/account" className={linkCls}>
                My account
              </Link>
              {hasRole("agency_owner", "agency_staff") ? (
                <Link href="/agency" className={linkCls}>
                  Agency
                </Link>
              ) : (
                <Link href="/become-agency" className={linkCls}>
                  List your cars
                </Link>
              )}
              {hasRole("platform_admin") ? (
                <Link href="/admin" className={linkCls}>
                  Admin
                </Link>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="ml-1"
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
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
