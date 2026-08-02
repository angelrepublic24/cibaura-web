"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CarFront,
  Clock,
  Inbox,
  LayoutDashboard,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import type { AgencyPermission } from "@/features/agency/rbac";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Permission required to see this item; undefined = always visible. */
  permission?: AgencyPermission;
};

const NAV: NavItem[] = [
  { href: "/agency", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agency/fleet", label: "Fleet", icon: CarFront, permission: "fleet:read" },
  { href: "/agency/calendar", label: "Calendar", icon: CalendarDays, permission: "calendar:manage" },
  { href: "/agency/requests", label: "Requests", icon: Inbox, permission: "bookings:read" },
  { href: "/agency/branches", label: "Branches", icon: Building2, permission: "branches:manage" },
  { href: "/agency/zones", label: "Delivery zones", icon: MapPin, permission: "zones:manage" },
  { href: "/agency/wallet", label: "Wallet", icon: Wallet, permission: "wallet:view" },
  { href: "/agency/staff", label: "Staff", icon: Users, permission: "staff:manage" },
];

/**
 * Verification notice shown above the dashboard content whenever the caller's
 * agency is NOT yet verified. Reads the same `GET /agency/session` cache entry
 * the nav already loads (identical key + staleTime → one request, not two).
 *
 * This is a secondary, informational read: while it loads or if it errors we
 * render nothing rather than blocking or alarming — the dashboard's own queries
 * surface real failures. Verified agencies see no banner.
 */
function VerificationBanner() {
  const { data } = useQuery({
    queryKey: agencyKeys.session(),
    queryFn: () => AgencyApi.session(),
    staleTime: 60_000,
  });

  const agency = data?.agency;
  if (!agency || agency.verificationStatus === "verified") return null;

  // `verificationReason` lives on the application record, not the dashboard
  // `Agency` type — read it defensively in case the session includes it.
  const reason =
    (agency as { verificationReason?: string | null }).verificationReason ??
    null;

  if (agency.verificationStatus === "rejected") {
    return (
      <div
        role="alert"
        className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-4"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-destructive">
            Your application was rejected.
          </p>
          {reason ? <p className="text-muted-foreground">{reason}</p> : null}
          <p className="text-muted-foreground">
            <Link
              href="/become-agency"
              className="font-medium text-destructive underline underline-offset-2 hover:no-underline"
            >
              Re-submit your documents
            </Link>{" "}
            to apply again.
          </p>
        </div>
      </div>
    );
  }

  // pending
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning-soft p-4"
    >
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="space-y-1 text-sm">
        <p className="font-medium text-warning">
          Your agency is pending verification
        </p>
        <p className="text-muted-foreground">
          Your cars won&apos;t appear in public search yet. Upload your
          documents from the{" "}
          <Link
            href="/become-agency"
            className="font-medium text-warning underline underline-offset-2 hover:no-underline"
          >
            application page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** /agency route group — agency owners and staff only, nav gated by permission. */
export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { can } = usePermission();

  // Fail CLOSED: while the session loads, `can` is false, so only unrestricted
  // items (Dashboard) show and the rest appear once permissions resolve. For an
  // RBAC surface a brief under-render beats flashing links the user can't use.
  const items = NAV.filter((item) => !item.permission || can(item.permission));

  return (
    <RoleGuard allow={["agency_owner", "agency_staff"]}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[210px_1fr]">
        <aside>
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {items.map((item) => {
              const active =
                item.href === "/agency"
                  ? pathname === "/agency"
                  : pathname.startsWith(item.href);
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
        <div>
          <VerificationBanner />
          {children}
        </div>
      </div>
    </RoleGuard>
  );
}
