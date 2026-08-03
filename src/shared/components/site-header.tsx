"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import { Button } from "@/shared/components/ui/button";
import { Logo } from "@/shared/components/logo";
import { cn } from "@/lib/utils";

/**
 * Global header: brand, primary nav and session-aware actions.
 * Role links are convenience only — the real gate is the RoleGuard +
 * backend RBAC.
 */
export function SiteHeader() {
  useMe(); // hydrate session on every page
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hasRole = useAuthStore((s) => s.hasRole);
  const signOut = useAuthStore((s) => s.signOut);

  const linkCls =
    "rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  const isAgency = hasRole("agency_owner", "agency_staff");
  const isAdmin = hasRole("platform_admin");
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
            isAgency ? (
              <>
                {/* Owners/staff keep the agency and customer sides SEPARATE —
                    this toggle is how they cross between the two ecosystems. */}
                <WorkspaceToggle inAgency={inAgency} />
                {!inAgency ? (
                  <Link href="/account" className={linkCls}>
                    My account
                  </Link>
                ) : null}
                {isAdmin ? (
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
                <Link
                  href="/agencies"
                  className={cn(linkCls, "hidden sm:inline-flex")}
                >
                  Agencies
                </Link>
                <Link href="/account" className={linkCls}>
                  My account
                </Link>
                <Link href="/become-agency" className={linkCls}>
                  List your cars
                </Link>
                {isAdmin ? (
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
            )
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

/**
 * Agency ⇄ Customer workspace switch for owners/staff. The two sides are kept
 * separate: this is the deliberate crossing between the agency workspace and
 * the customer marketplace. The active side reflects the current route.
 */
function WorkspaceToggle({ inAgency }: { inAgency: boolean }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border text-sm">
      <Link
        href="/agency"
        className={cn(
          "px-3 py-1.5 font-medium transition-colors",
          inAgency
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        Agency
      </Link>
      <Link
        href="/"
        className={cn(
          "border-l border-border px-3 py-1.5 font-medium transition-colors",
          !inAgency
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        Customer
      </Link>
    </div>
  );
}
