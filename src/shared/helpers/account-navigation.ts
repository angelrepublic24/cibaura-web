import type { Role } from "@/shared/types/domain";

export const ACCOUNT_SETTINGS_PATH = "/account/settings/profile";

/** First and last initials; a single display name uses its first two letters. */
export function accountInitials(name?: string, email?: string): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const first = words[0] ?? "";
  const last = words[words.length - 1] ?? "";
  if (words.length > 1) return `${Array.from(first)[0] ?? ""}${Array.from(last)[0] ?? ""}`.toUpperCase();
  return Array.from(words[0] || email?.split("@")[0] || "?").slice(0, 2).join("").toUpperCase();
}

export type AccountMenuMode = "closed" | "hover" | "explicit";
export type AccountMenuAction = "hover" | "leave" | "toggle" | "open" | "close";

/** A click pins a hover-open menu instead of closing it on its first click. */
export function accountMenuReducer(mode: AccountMenuMode, action: AccountMenuAction): AccountMenuMode {
  switch (action) {
    case "hover": return mode === "closed" ? "hover" : mode;
    case "leave": return mode === "hover" ? "closed" : mode;
    case "toggle": return mode === "explicit" ? "closed" : "explicit";
    case "open": return "explicit";
    case "close": return "closed";
  }
}

const inArea = (pathname: string, area: string) => pathname === area || pathname.startsWith(`${area}/`);

export function accountSettingsHref(pathname: string, roles: Role[]): string {
  return roles.includes("platform_admin") && inArea(pathname, "/admin")
    ? "/admin/profile"
    : ACCOUNT_SETTINGS_PATH;
}

export function accountWorkspaceLinks(pathname: string, roles: Role[]) {
  const links: { href: string; label: string; kind: "customer" | "agency" | "admin" }[] = [];
  if (roles.some((role) => role === "agency_owner" || role === "agency_staff")) {
    links.push(inArea(pathname, "/agency")
      ? { href: "/", label: "Switch to customer", kind: "customer" }
      : { href: "/agency", label: "Switch to agency workspace", kind: "agency" });
  }
  if (roles.includes("platform_admin")) {
    links.push(inArea(pathname, "/admin")
      ? { href: "/", label: "Switch to customer", kind: "customer" }
      : { href: "/admin", label: "Switch to admin console", kind: "admin" });
  }
  return links;
}
