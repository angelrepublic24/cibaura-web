"use client";

import { usePathname } from "next/navigation";
import { RoleGuard } from "@/shared/auth/guard";

/** Rentals, Favorites and booking details stay in the public marketplace frame. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const settings = pathname === "/account/settings" || pathname.startsWith("/account/settings/");
  return (
    <RoleGuard allow={["customer", "agency_owner", "agency_staff", "platform_admin"]}>
      <div className={settings ? "w-full" : "marketplace-shell py-8"}>{children}</div>
    </RoleGuard>
  );
}
