"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleGuard } from "@/shared/auth/guard";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/account", label: "Bookings" },
  { href: "/account/payment-methods", label: "Payment methods" },
  { href: "/account/profile", label: "Profile" },
];

/**
 * /account route group — any authenticated user (agency owners are also
 * customers when they rent). Real authorization is backend RBAC.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <RoleGuard allow={["customer", "agency_owner", "agency_staff", "platform_admin"]}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-3xl text-foreground">My account</h1>
        <div className="mt-5 flex gap-1 border-b border-border">
          {NAV.map((item) => {
            const active =
              item.href === "/account"
                ? pathname === "/account" || pathname.startsWith("/account/bookings")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="py-6">{children}</div>
      </div>
    </RoleGuard>
  );
}
