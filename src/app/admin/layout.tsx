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
  type LucideIcon,
} from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

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

/** Every destination, flat — `isActive` needs the whole set to disambiguate. */
const ALL_ITEMS: NavItem[] = NAV.flatMap((group) => group.items);

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

/** The settings destinations, flat — same reason as {@link ALL_ITEMS}. */
const SETTINGS_ITEMS: NavItem[] = SETTINGS_NAV.flatMap((group) => group.items);

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
  const flat = inSettings ? SETTINGS_ITEMS : ALL_ITEMS;

  return (
    <RoleGuard allow={["platform_admin"]}>
      {/*
        AN APP SHELL, NOT A PAGE. The console fills what the site header leaves
        (`h-16`) and the two columns scroll INDEPENDENTLY: reading a long
        orders table used to carry the navigation off the top of the screen,
        so changing section meant scrolling back up first.

        `min-h-0` on the children is what makes that work — without it a flex
        child refuses to shrink below its content and neither side ever scrolls.
      */}
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden md:flex-row">
        <aside className="flex w-56 flex-none flex-col bg-muted/50 max-md:hidden">
          <div className="flex-none px-4 pb-2 pt-4">
            {inSettings ? (
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
            )}
          </div>

          {/* The nav scrolls; the heading above it does not. */}
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {groups.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-2 pb-1 pt-3 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href, pathname, flat);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-primary font-medium text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 flex-none" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/*
          THE SEPARATOR. A hairline that fades out at both ends rather than
          cutting edge to edge — it divides without reading as a wall. It is
          its own element because a `border-r` cannot fade.
        */}
        <div
          aria-hidden
          className="w-px flex-none bg-gradient-to-b from-transparent via-border to-transparent max-md:hidden"
        />

        {/* On phones the nav becomes a scrollable strip above the content. */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {flat.map((item) => {
            const active = isActive(item.href, pathname, flat);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-none items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}

/**
 * Longest-prefix active check on segment boundaries: an item is active when its
 * href is a prefix of the current path AND no sibling with a longer href also
 * matches. This keeps "/admin" from lighting up on every sub-route and keeps
 * "General" (/admin/settings) inactive while on /admin/settings/integrations.
 */
function isActive(href: string, pathname: string, items: NavItem[]): boolean {
  const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
  if (!matches(href)) return false;
  return !items.some(
    (o) => o.href !== href && o.href.length > href.length && matches(o.href),
  );
}
