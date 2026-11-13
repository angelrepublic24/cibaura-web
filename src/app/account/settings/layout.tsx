"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  CreditCard,
  IdCard,
  LockKeyhole,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useAuthStore } from "@/shared/auth/store";
import { accountInitials } from "@/shared/helpers/account-navigation";
import "./settings.css";

const ITEMS = [
  { href: "/account/settings/profile", label: "Profile", icon: UserRound },
  { href: "/account/settings/documents", label: "Documents", icon: IdCard },
  {
    href: "/account/settings/payment-methods",
    label: "Payment methods",
    icon: CreditCard,
  },
  { href: "/account/settings/security", label: "Security", icon: LockKeyhole },
  {
    href: "/account/settings/privacy",
    label: "Privacy & account",
    icon: SlidersHorizontal,
  },
];

/** Only Settings gets a sidebar; phones retain all destinations in a compact grid. */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const current =
    ITEMS.find((item) => item.href === pathname) ??
    ITEMS.find(
      (item) =>
        item.href.endsWith("/privacy") &&
        [
          "/account/settings/blocked",
          "/account/settings/delete-account",
        ].includes(pathname),
    ) ??
    ITEMS[0];
  return (
    <div className="settings-studio">
      <aside className="settings-rail">
        <div className="settings-rail-title">
          <span className="settings-eyebrow">Your account</span>
          <h1>Settings</h1>
        </div>
        <nav aria-label="Settings" className="settings-nav">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={current?.href === href ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="settings-rail-account">
          <span className="settings-avatar" aria-hidden="true">
            {accountInitials(user?.fullName, user?.email)}
          </span>
          <div>
            <strong>{user?.fullName}</strong>
            <small>Personal account</small>
          </div>
        </div>
      </aside>
      <div className="settings-main">
        <div className="settings-breadcrumb">
          Settings <ChevronRight aria-hidden="true" />
          <span>{current?.label}</span>
        </div>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
