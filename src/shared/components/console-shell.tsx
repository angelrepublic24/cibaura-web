"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConsoleNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** A labelled run of destinations. Omit the label for a single flat list. */
export type ConsoleNavGroup = {
  label?: string;
  items: ConsoleNavItem[];
};

/**
 * THE SHELL EVERY ROLE AREA SITS IN — admin, agency and account.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────
 *
 * An APP, not a page. It fills exactly what the site header leaves (`h-16`)
 * and the two columns scroll INDEPENDENTLY: reading a long table used to
 * carry the navigation off the top of the screen, so changing section meant
 * scrolling back up first.
 *
 * `min-h-0` on the flex children is what makes that work — without it a flex
 * child refuses to shrink below its content and neither side ever scrolls.
 *
 * ── WHY IT IS FULL WIDTH ─────────────────────────────────────────────────
 *
 * The console had no business being capped at `max-w-6xl`. These screens are
 * fleet tables, booking queues, calendars and ledgers — the things a wide
 * monitor exists for. The cap left an operator reading a nine-column table
 * through a letterbox while a third of their screen stayed empty. Content
 * that genuinely wants a measure (a form, a paragraph) caps itself; the
 * frame should not do it on everyone's behalf.
 *
 * ── WHY ONE COMPONENT ────────────────────────────────────────────────────
 *
 * Three route groups drew the same two-column frame three times, and they
 * had already drifted: the admin console was an app shell while /agency and
 * /account were centred pages, and their "which item is active" rules were
 * three different functions, one of which lit the wrong link on sibling
 * paths. One shell means "the agency console looks like the admin console"
 * stays true without anybody maintaining it.
 */
export function ConsoleShell({
  groups,
  header,
  banner,
  children,
}: {
  groups: ConsoleNavGroup[];
  /** Sits above the nav: a title, or a "back" link out of a sub-section. */
  header?: React.ReactNode;
  /** Rendered above the page, inside the scrolling column (notices). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const flat = groups.flatMap((group) => group.items);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden md:flex-row">
      <aside className="flex w-56 flex-none flex-col bg-muted/50 max-md:hidden">
        {header ? <div className="flex-none px-4 pb-2 pt-4">{header}</div> : null}

        {/* The nav scrolls; whatever sits above it does not. */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className="mb-1">
              {group.label ? (
                <p className="px-2 pb-1 pt-3 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
              ) : null}
              <div className={cn("flex flex-col gap-0.5", !group.label && "pt-3")}>
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href, pathname, flat)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/*
        THE SEPARATOR. A hairline that fades out at both ends rather than
        cutting edge to edge — it divides without reading as a wall. It is
        its own element because a `border-r` cannot fade.
      */}
      <div
        aria-hidden
        className="w-px flex-none bg-gradient-to-b from-transparent via-border to-transparent max-md:hidden"
      />

      {/* On phones the nav becomes a scrollable strip above the content. */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
        {flat.map((item) => {
          const active = isActive(item.href, pathname, flat);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-none items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        {banner}
        {children}
      </main>
    </div>
  );
}

function SidebarLink({
  item,
  active,
}: {
  item: ConsoleNavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary font-medium text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 flex-none" />
      {item.label}
    </Link>
  );
}

/**
 * Longest-prefix active check ON SEGMENT BOUNDARIES: an item is active when
 * its href is a prefix of the current path AND no sibling with a longer href
 * also matches.
 *
 * Both halves earn their keep. The longest-prefix part keeps "/admin" from
 * lighting up on every sub-route. The segment boundary keeps "/agency/fleet"
 * from lighting up on "/agency/fleets" — a plain `startsWith`, which two of
 * the three layouts used, does exactly that.
 */
export function isActive(
  href: string,
  pathname: string,
  items: ConsoleNavItem[],
): boolean {
  const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
  if (!matches(href)) return false;
  return !items.some(
    (other) =>
      other.href !== href &&
      other.href.length > href.length &&
      matches(other.href),
  );
}
