"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarRange,
  CreditCard,
  FileText,
  Heart,
  LogOut,
  Store,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/shared/auth/store";
import { cn } from "@/lib/utils";

/**
 * Avatar → account dropdown. Everything lives here now: the customer settings
 * links, the agency⇄customer role switch (only when the user actually holds an
 * agency role), and log out. Closes on outside-click, Escape, and navigation.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hasRole = useAuthStore((s) => s.hasRole);
  const signOut = useAuthStore((s) => s.signOut);

  const isAgency = hasRole("agency_owner", "agency_staff");
  const isAdmin = hasRole("platform_admin");
  const inAgency = pathname.startsWith("/agency");

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close whenever the route changes (a menu link was followed).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const initial = (user?.fullName ?? user?.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.fullName ?? "Account"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>

          {isAgency ? (
            <div className="border-b border-border py-1">
              <MenuLink
                href={inAgency ? "/" : "/agency"}
                icon={inAgency ? Store : Building2}
              >
                {inAgency ? "Switch to customer" : "Switch to agency workspace"}
              </MenuLink>
            </div>
          ) : null}

          <div className="py-1">
            <MenuLink href="/account" icon={CalendarRange}>
              My rentals
            </MenuLink>
            <MenuLink href="/account/profile" icon={UserIcon}>
              Profile &amp; settings
            </MenuLink>
            <MenuLink href="/account/favorites" icon={Heart}>
              Favorites
            </MenuLink>
            <MenuLink href="/account/payment-methods" icon={CreditCard}>
              Payment methods
            </MenuLink>
            <MenuLink href="/account/verification" icon={FileText}>
              Documents
            </MenuLink>
            {isAdmin ? (
              <MenuLink href="/admin" icon={Building2}>
                Admin
              </MenuLink>
            ) : null}
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </Link>
  );
}
