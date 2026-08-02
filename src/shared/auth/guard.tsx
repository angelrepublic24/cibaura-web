"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import type { Role } from "@/shared/types/domain";
import { LoadingState } from "@/shared/components/states";
import { buttonVariants } from "@/shared/components/ui/button";

/**
 * Simple client-side role guard skeleton wrapped around protected route
 * groups (/account, /agency, /admin) via their layouts.
 *
 * - guest        -> redirect to /auth/login?next=<current path>
 * - wrong role   -> "no access" card (no redirect loop)
 * - hydrating    -> loading block
 *
 * NOTE: this is UX-level gating only. REAL authorization lives in the
 * backend (RBAC on every endpoint); nothing sensitive is trusted to
 * this component.
 */
export function RoleGuard({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  useMe(); // hydrate the session store
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const allowed = !!user && allow.some((r) => user.roles.includes(r));

  useEffect(() => {
    if (status === "guest") {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "unknown") return <LoadingState label="Checking session…" />;
  if (status === "guest") return <LoadingState label="Redirecting to login…" />;

  if (!allowed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">No access</h2>
        <p className="text-sm text-muted-foreground">
          Your account does not have permission to view this area.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
