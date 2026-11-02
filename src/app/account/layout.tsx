"use client";

import {
  Ban,
  CalendarRange,
  CreditCard,
  FileText,
  Heart,
  User,
} from "lucide-react";
import { useHasModerationRole } from "@/modules/moderation/hooks/use-moderation-gate.hook";
import { RoleGuard } from "@/shared/auth/guard";
import {
  ConsoleShell,
  type ConsoleNavItem,
} from "@/shared/components/console-shell";

const NAV: ConsoleNavItem[] = [
  { href: "/account", label: "My rentals", icon: CalendarRange },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/verification", label: "Documents", icon: FileText },
  { href: "/account/payment-methods", label: "Payment methods", icon: CreditCard },
  { href: "/account/favorites", label: "Favorites", icon: Heart },
];

/**
 * Last, next to Favorites: both are lists of agencies the user curated, and
 * this is the only route where a block can be undone.
 *
 * SHOWN BY ROLE, because this row is the one in `/account` whose page cannot
 * answer for everybody the guard lets in. `GET /blocks` is
 * `@Auth(customer, agency_owner, agency_staff)`, so a platform_admin pressing
 * it would land on "Could not load your blocked list" — and they have no
 * blocks to undo in the first place: nothing offers an admin the block
 * action. The nav is convenience, so it offers only what works.
 */
const BLOCKED_NAV: ConsoleNavItem = {
  href: "/account/blocked",
  label: "Blocked",
  icon: Ban,
};

/**
 * /account route group — settings-style left sidebar. Any authenticated user
 * (agency owners are also customers when they rent). Real authorization is
 * backend RBAC; this nav is convenience only.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard
      allow={["customer", "agency_owner", "agency_staff", "platform_admin"]}
    >
      <AccountShell>{children}</AccountShell>
    </RoleGuard>
  );
}

/**
 * Inside the guard on purpose: the session is resolved by the time this
 * renders, so the nav is built once from a known role set rather than
 * flickering a row in as `useMe` lands.
 */
function AccountShell({ children }: { children: React.ReactNode }) {
  const canUnblock = useHasModerationRole();
  const items = canUnblock ? [...NAV, BLOCKED_NAV] : NAV;

  return (
    <ConsoleShell
      groups={[{ items }]}
      header={
        <p className="font-display text-base leading-none text-foreground">
          Account
        </p>
      }
    >
      {children}
    </ConsoleShell>
  );
}
