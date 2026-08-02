"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Percent, Library, MapPin } from "lucide-react";
import { RoleGuard } from "@/shared/auth/guard";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Commission", icon: Percent },
  { href: "/admin/catalog", label: "Catalog", icon: Library },
  { href: "/admin/geo", label: "Geo", icon: MapPin },
];

/** /admin route group — platform admins only. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[210px_1fr]">
        <aside>
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {NAV.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
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
