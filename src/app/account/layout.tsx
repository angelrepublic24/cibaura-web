"use client";

import {
  CalendarRange,
  CreditCard,
  FileText,
  Heart,
  User,
} from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import { ConsoleShell } from "@/shared/components/console-shell";

const NAV = [
  { href: "/account", label: "My rentals", icon: CalendarRange },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/verification", label: "Documents", icon: FileText },
  { href: "/account/payment-methods", label: "Payment methods", icon: CreditCard },
  { href: "/account/favorites", label: "Favorites", icon: Heart },
];

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
      <ConsoleShell
        groups={[{ items: NAV }]}
        header={
          <p className="font-display text-base leading-none text-foreground">
            Account
          </p>
        }
      >
        {children}
      </ConsoleShell>
    </RoleGuard>
  );
}
