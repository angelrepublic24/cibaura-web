"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Wallet,
  ClipboardCheck,
  UserCheck,
  Users,
  Banknote,
  Gavel,
  Landmark,
  Library,
  MapPin,
  ScrollText,
  UserCircle,
  ShieldCheck,
  ArrowLeft,
  SlidersHorizontal,
  Plug,
} from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import {
  ConsoleShell,
  type ConsoleNavGroup,
} from "@/shared/components/console-shell";

type NavGroup = ConsoleNavGroup;

/**
 * Main console navigation, GROUPED.
 *
 * Sixteen destinations in one flat list means re-reading all sixteen to find
 * one, every time. The headings are what let the eye jump: an admin looking
 * for payouts looks under Money, not through the alphabet.
 *
 * The grouping follows what the admin is DOING, not which module the code
 * lives in — "Applications" sits with Agencies because reviewing one is part
 * of running supply, even though it is a different screen.
 */
const NAV: NavGroup[] = [
  {
    label: "Operation",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/claims", label: "Claims", icon: Gavel },
    ],
  },
  {
    label: "Supply",
    items: [
      { href: "/admin/agencies", label: "Agencies", icon: Building2 },
      {
        href: "/admin/agency-applications",
        label: "Applications",
        icon: ClipboardCheck,
      },
      { href: "/admin/catalog", label: "Catalog", icon: Library },
      { href: "/admin/geo", label: "Geo", icon: MapPin },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/admin/revenue", label: "Revenue", icon: Wallet },
      { href: "/admin/payouts", label: "Payouts", icon: Banknote },
      {
        href: "/admin/payout-accounts",
        label: "Payout accounts",
        icon: Landmark,
      },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/verification", label: "Customer KYC", icon: UserCheck },
      { href: "/admin/roots", label: "Admins", icon: ShieldCheck },
    ],
  },
  {
    // Settings and Profile are deliberately ABSENT: both live in the account
    // menu now. Neither is a place you work — you go, change one thing and
    // leave — so a permanent slot in the rail next to the queues an admin
    // actually works through was weight they had not earned.
    label: "System",
    items: [
      { href: "/admin/contracts", label: "Contracts", icon: ScrollText },
    ],
  },
];

/**
 * Settings sub-navigation. When the admin enters the Settings section the whole
 * sidebar SWAPS to this focused set (with a "Back to console" affordance at the
 * top) instead of stacking a second sidebar next to the main one.
 */
const SETTINGS_NAV: NavGroup[] = [
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "General", icon: SlidersHorizontal },
      {
        href: "/admin/settings/integrations",
        label: "Integrations",
        icon: Plug,
      },
      // Your own account, including the change-password card. Once you are in
      // Settings you expect everything you can change to be here — hunting for
      // your password back in the account menu is a dead end you only find by
      // leaving.
      { href: "/admin/profile", label: "Your account", icon: UserCircle },
    ],
  },
];

/** /admin route group — platform admins only. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // The accept-invite screen is a PUBLIC account-creation entry reached from an
  // emailed link. It lives under /admin only for a tidy URL and must render for
  // logged-out invitees — so it skips the platform-admin guard and the admin
  // console chrome (nav/sidebar) entirely.
  if (pathname === "/admin/accept-invite") {
    return <>{children}</>;
  }

  // In the Settings section the sidebar SWAPS to the settings sub-nav.
  //
  // `/admin/profile` counts as part of it even though it does not live under
  // that path: it is listed in the sub-nav, and without this the sidebar would
  // swap back to the main one the moment you clicked it — the navigation
  // changing under your hand as a result of using it.
  const inSettings =
    pathname.startsWith("/admin/settings") ||
    pathname === "/admin/profile" ||
    pathname.startsWith("/admin/profile/");
  const groups = inSettings ? SETTINGS_NAV : NAV;

  return (
    <RoleGuard allow={["platform_admin"]}>
      <ConsoleShell
        groups={groups}
        header={
          inSettings ? (
            <Link
              href="/admin"
              className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to console
            </Link>
          ) : (
            <p className="font-display text-base leading-none text-foreground">
              Console
            </p>
          )
        }
      >
        {children}
      </ConsoleShell>
    </RoleGuard>
  );
}
