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
  Library,
  MapPin,
  ShieldCheck,
  Settings,
  UserCircle,
  ArrowLeft,
  SlidersHorizontal,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Main console navigation. */
const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/agencies", label: "Agencies", icon: Building2 },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/revenue", label: "Revenue", icon: Wallet },
  {
    href: "/admin/agency-applications",
    label: "Applications",
    icon: ClipboardCheck,
  },
  { href: "/admin/verification", label: "Customer KYC", icon: UserCheck },
  { href: "/admin/catalog", label: "Catalog", icon: Library },
  { href: "/admin/geo", label: "Geo", icon: MapPin },
  { href: "/admin/roots", label: "Admins", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/profile", label: "Profile", icon: UserCircle },
];

/**
 * Settings sub-navigation. When the admin enters the Settings section the whole
 * sidebar SWAPS to this focused set (with a "Back to console" affordance at the
 * top) instead of stacking a second sidebar next to the main one.
 */
const SETTINGS_NAV: NavItem[] = [
  { href: "/admin/settings", label: "General", icon: SlidersHorizontal },
  { href: "/admin/settings/integrations", label: "Integrations", icon: Plug },
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
  const inSettings = pathname.startsWith("/admin/settings");
  const items = inSettings ? SETTINGS_NAV : NAV;

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[210px_1fr]">
        <aside>
          {inSettings ? (
            <div className="mb-3">
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to console
              </Link>
              <p className="mt-2 px-3 font-display text-lg text-foreground">
                Settings
              </p>
            </div>
          ) : null}
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {items.map((item) => {
              const active = isActive(item.href, pathname, items);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div>{children}</div>
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
