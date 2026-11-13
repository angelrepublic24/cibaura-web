"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Wallet,
  ClipboardCheck,
  Flag,
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
 *
 * ── WHAT EARNS A SLOT HERE ───────────────────────────────────────────────
 *
 * The rail is for what you WORK: queues, cases, money, people — things with
 * a backlog that changes while you are away. What you CONFIGURE and then do
 * not touch for weeks lives in Settings instead, reached from the account
 * menu.
 *
 * That line moved Catalog, Geo and Contracts out. Catalog is a dictionary of
 * makes and models, extended when a new car shows up; Geo is countries,
 * cities and the per-country tax rate; Contracts is the legal templates
 * renters and hosts sign. None of the three is a queue, and the first two
 * sat under "Supply" next to the real agencies, which read as if they were
 * the same kind of work.
 *
 * The routes did not change, so saved links still resolve.
 */
const NAV: NavGroup[] = [
  {
    label: "Operation",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/claims", label: "Claims", icon: Gavel },
      // The moderation queue sits with the other things an admin works
      // through, not under People: a report is a job, not a person.
      { href: "/admin/reports", label: "Reports", icon: Flag },
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
];

/**
 * Settings sub-navigation. When the admin enters the Settings section the whole
 * sidebar SWAPS to this focused set (with a "Back to console" affordance at the
 * top) instead of stacking a second sidebar next to the main one.
 *
 * Grouped, because six destinations answer three different questions: how the
 * platform behaves, what the reference data says, and who you are.
 */
const SETTINGS_NAV: NavGroup[] = [
  {
    // What the platform DOES: the commission, the deposit, the cancellation
    // policy, the documents those rules are written into, and the third
    // parties they run through.
    label: "Platform",
    items: [
      { href: "/admin/settings", label: "General", icon: SlidersHorizontal },
      { href: "/admin/contracts", label: "Contracts", icon: ScrollText },
      {
        href: "/admin/settings/integrations",
        label: "Integrations",
        icon: Plug,
      },
    ],
  },
  {
    // The lists everything else is chosen FROM. Geo is here rather than under
    // Platform despite carrying the per-country tax rate: an admin opens it to
    // add a city far more often than to change a rate.
    label: "Reference data",
    items: [
      { href: "/admin/catalog", label: "Catalog", icon: Library },
      { href: "/admin/geo", label: "Geo", icon: MapPin },
    ],
  },
  {
    // Your own account, including the change-password card. Once you are in
    // Settings you expect everything you can change to be here — hunting for
    // your password back in the account menu is a dead end you only find by
    // leaving.
    label: "You",
    items: [
      { href: "/admin/profile", label: "Your account", icon: UserCircle },
    ],
  },
];

/**
 * Paths that keep the Settings sidebar up even though they do not live under
 * `/admin/settings`. Without this the rail would swap back to the main console
 * the moment you clicked one of them — the navigation changing under your hand
 * as a result of using it.
 */
const SETTINGS_PATHS = [
  "/admin/profile",
  "/admin/contracts",
  "/admin/catalog",
  "/admin/geo",
] as const;

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

  // In the Settings section the sidebar SWAPS to the settings sub-nav — see
  // SETTINGS_PATHS for the destinations that belong to it without living
  // under `/admin/settings`.
  const inSettings =
    pathname.startsWith("/admin/settings") ||
    SETTINGS_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
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
