"use client";

import Link from "next/link";
import { useAuthStore } from "@/shared/auth/store";

/**
 * Footer "Explore" column — session-aware. "Become an agency" is hidden once
 * you already manage an agency (owner/staff), and "Log in" is hidden while
 * authenticated. The store is hydrated by <SiteHeader/>'s useMe().
 */
export function SiteFooterNav() {
  const status = useAuthStore((s) => s.status);
  const hasRole = useAuthStore((s) => s.hasRole);
  const isAgency = hasRole("agency_owner", "agency_staff");
  const isAuthenticated = status === "authenticated";

  return (
    <nav className="flex flex-col gap-2 text-sm text-cream/80">
      <span className="text-xs font-semibold uppercase tracking-wide text-cream/50">
        Explore
      </span>
      <Link href="/cars/santiago" className="hover:text-cream">
        Browse cars
      </Link>
      <Link href="/agencies" className="hover:text-cream">
        Agencies
      </Link>
      {!isAgency ? (
        <Link href="/become-agency" className="hover:text-cream">
          Become an agency
        </Link>
      ) : null}
      {!isAuthenticated ? (
        <Link href="/auth/login" className="hover:text-cream">
          Log in
        </Link>
      ) : null}
    </nav>
  );
}
