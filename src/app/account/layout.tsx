"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  CreditCard,
  FileText,
  Heart,
  User,
} from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();

  return (
    <RoleGuard allow={["customer", "agency_owner", "agency_staff", "platform_admin"]}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[210px_1fr]">
        <aside>
          <h1 className="mb-3 px-3 font-display text-xl text-foreground">
            Account
          </h1>
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {NAV.map((item) => {
              const active =
                item.href === "/account"
                  ? pathname === "/account" ||
                    pathname.startsWith("/account/bookings")
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
        <div>{children}</div>
      </div>
    </RoleGuard>
  );
}
