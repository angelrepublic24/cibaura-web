"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CarFront,
  FilePenLine,
  Inbox,
  LayoutDashboard,
  Store,
  MapPin,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import { LoadingState } from "@/shared/components/states";
import {
  AgencyAccessRevoked,
  isAgencyAccessRevokedError,
  isRevokedStatus,
  useAgencyAccessRevokedWatcher,
} from "@/features/agency/access-revoked";
import { AgencyApplicationReview } from "@/features/agency/application-review";
import { useAgencySession } from "@/features/agency/hooks";
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
  { href: "/agency/walk-in", label: "Walk-in sale", icon: Store, permission: "bookings:handle" },
  { href: "/agency/branches", label: "Branches", icon: Building2, permission: "branches:manage" },
  { href: "/agency/zones", label: "Delivery zones", icon: MapPin, permission: "zones:manage" },
  { href: "/agency/wallet", label: "Wallet", icon: Wallet, permission: "wallet:view" },
  { href: "/agency/staff", label: "Staff", icon: Users, permission: "staff:manage" },
  { href: "/agency/settings", label: "Settings", icon: Settings, permission: "agency:settings" },
];

/**
 * Host-agreement nudges (ADR-0010): never signed → cars cannot be published
 * or requests accepted; a newer version with `requireResign` → sign again
 * (listings stay live). Both point at Settings, where the owner signs. Read
 * defensively: a session that predates the flags shows nothing.
 */
function HostAgreementBanner() {
  const { data } = useAgencySession();
  const { can } = usePermission();
  const agency = data?.agency;
  if (!agency) return null;

  const unsigned = agency.hostAgreementSigned === false;
  const resign = agency.hostAgreementResignRequired === true;
  if (!unsigned && !resign) return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning-soft p-4"
    >
      <FilePenLine className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="space-y-1 text-sm">
        <p className="font-medium text-warning">
          {unsigned
            ? "The host agreement has not been signed"
            : "A new version of the host agreement needs your signature"}
        </p>
        <p className="text-muted-foreground">
          {unsigned
            ? "Cars cannot be published and requests cannot be accepted until the owner signs it"
            : "Your listings stay live meanwhile — the owner can sign the new version"}
          {can("agency:settings") ? (
            <>
              {" "}
              in{" "}
              <Link
                href="/agency/settings"
                className="font-medium text-warning underline underline-offset-2 hover:no-underline"
              >
                Settings
              </Link>
              .
            </>
          ) : (
            "."
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * /agency route group — agency owners and staff only, nav gated by permission.
 *
 * STATUS GATE (owner rule), applied ONCE here rather than per page, because
 * every child query/mutation would otherwise just 403 on its own. `GET
 * /agency/session` is the read the backend keeps answering in every state, so
 * it decides which of three surfaces the route group renders:
 *
 *  - rejected / suspended → {@link AgencyAccessRevoked} (403
 *    AGENCY_ACCESS_REVOKED everywhere else). The watcher covers the
 *    mid-session case: any child 403 with that code refetches the session so
 *    this layout flips over instead of panels erroring one by one.
 *  - pending → {@link AgencyApplicationReview}: an applicant may ENTER the
 *    space but writes nothing (403 AGENCY_APPLICATION_UNDER_REVIEW), so the
 *    dashboard would be a wall of failing buttons. They get their application
 *    file instead. No watcher is needed in this direction — an agency only
 *    ever leaves `pending`, never returns to it.
 *  - verified → the dashboard.
 */
export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { can } = usePermission();
  useAgencyAccessRevokedWatcher();

  // Same cache entry as usePermission/HostAgreementBanner — one request total.
  const sessionQuery = useAgencySession();
  const agency = sessionQuery.data?.agency;
  const revoked =
    isRevokedStatus(agency?.verificationStatus) ||
    // Defensive: if the session read itself ever returns the revoked 403.
    isAgencyAccessRevokedError(sessionQuery.error);

  // Fail CLOSED: while the session loads, `can` is false, so only unrestricted
  // items (Dashboard) show and the rest appear once permissions resolve. For an
  // RBAC surface a brief under-render beats flashing links the user can't use.
  // Individual hosts have no staff (ADR-0009) — the Staff surface is hidden.
  const individual = agency?.kind === "individual";
  const items = NAV.filter(
    (item) =>
      (!item.permission || can(item.permission)) &&
      !(individual && item.href === "/agency/staff"),
  );

  // The status decides WHICH surface this route group IS, so none of them can
  // be drawn before it is known. Falling through to the dashboard meanwhile
  // flashed a panel at an applicant a moment before replacing it with their
  // application file — the very "wall of buttons that 403" the rule exists to
  // prevent, and clickable while it lasts. The cost is that the dashboard's
  // own queries start after the session read instead of beside it, on the
  // FIRST entry only: `staleTime` serves every later navigation from cache.
  // An errored session is not a loading one — it still falls through, so a
  // transient failure degrades to the panel exactly as it did before.
  if (sessionQuery.isLoading) {
    return (
      <RoleGuard allow={["agency_owner", "agency_staff"]}>
        <LoadingState label="Loading your agency…" />
      </RoleGuard>
    );
  }

  if (revoked) {
    return (
      <RoleGuard allow={["agency_owner", "agency_staff"]}>
        <AgencyAccessRevoked
          status={agency?.verificationStatus}
          reason={agency?.verificationReason}
        />
      </RoleGuard>
    );
  }

  if (agency?.verificationStatus === "pending") {
    return (
      <RoleGuard allow={["agency_owner", "agency_staff"]}>
        <AgencyApplicationReview agency={agency} />
      </RoleGuard>
    );
  }

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
          <HostAgreementBanner />
          {children}
        </div>
      </div>
    </RoleGuard>
  );
}
