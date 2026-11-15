"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarRange, Heart, HelpCircle, LogOut, Settings, SlidersHorizontal, ShieldCheck, Store, type LucideIcon } from "lucide-react";
import { useAuthStore } from "@/shared/auth/store";
import { useLogout } from "@/modules/auth/hooks/auth.hook";
import { accountInitials, accountMenuReducer, accountSettingsHref, accountWorkspaceLinks } from "@/shared/helpers/account-navigation";
import { SUPPORT_PATH } from "@/shared/config/support";

/** Pointer, touch and keyboard account navigation share the same disclosure. */
export function UserMenu() {
  const [mode, dispatch] = useReducer(accountMenuReducer, "closed");
  const open = mode !== "closed";
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes("platform_admin");
  const workspaces = accountWorkspaceLinks(pathname, roles);

  useEffect(() => { dispatch("close"); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = () => dispatch("close");
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", close);
    };
  }, [open]);

  function focusEdge(last = false) {
    dispatch("open");
    window.requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items?.[last ? items.length - 1 : 0]?.focus();
    });
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") dispatch("hover"); }}
      onPointerLeave={() => { if (!rootRef.current?.contains(document.activeElement)) dispatch("leave"); }}
      onBlurCapture={(event) => { if (!rootRef.current?.contains(event.relatedTarget as Node | null)) dispatch("close"); }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Account menu"
        onClick={(event) => {
          dispatch("toggle");
          if (event.detail === 0 && mode !== "explicit") focusEdge();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            focusEdge(event.key === "ArrowUp");
          }
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        {accountInitials(user?.fullName, user?.email)}
      </button>

      {open ? (
        // Padding bridges the pointer path from the avatar into the popup.
        <div className="absolute right-0 top-full z-50 w-64 max-w-[calc(100vw-2rem)] pt-2">
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Account"
            className="max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-[var(--radius)] border border-border bg-surface shadow-lg"
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
              const current = items.indexOf(document.activeElement as HTMLElement);
              const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
                : event.key === "ArrowDown" ? (current + 1) % items.length
                  : (current - 1 + items.length) % items.length;
              items[index]?.focus();
            }}
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-medium text-foreground">{user?.fullName ?? "Account"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="py-1">
              <MenuLink href="/account" icon={CalendarRange} close={() => dispatch("close")}>Rentals</MenuLink>
              <MenuLink href="/account/favorites" icon={Heart} close={() => dispatch("close")}>Favorites</MenuLink>
              <MenuLink href={accountSettingsHref(pathname, roles)} icon={Settings} close={() => dispatch("close")}>Settings</MenuLink>
              <MenuLink href={SUPPORT_PATH} icon={HelpCircle} close={() => dispatch("close")}>Help &amp; support</MenuLink>
            </div>
            {workspaces.length || isAdmin ? (
              <div className="border-t border-border py-1">
                {workspaces.map((item) => (
                  <MenuLink key={item.href} href={item.href} icon={item.kind === "customer" ? Store : item.kind === "agency" ? Building2 : ShieldCheck} close={() => dispatch("close")}>{item.label}</MenuLink>
                ))}
                {isAdmin ? <MenuLink href="/admin/settings" icon={SlidersHorizontal} close={() => dispatch("close")}>Platform settings</MenuLink> : null}
              </div>
            ) : null}
            <div className="border-t border-border py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => { dispatch("close"); void logout(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({ href, icon: Icon, children, close }: { href: string; icon: LucideIcon; children: React.ReactNode; close: () => void }) {
  return <Link href={href} role="menuitem" onClick={close} className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"><Icon className="h-4 w-4 text-muted-foreground" />{children}</Link>;
}
