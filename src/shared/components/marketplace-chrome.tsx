"use client";

import { usePathname } from "next/navigation";

/**
 * Route prefixes that render a CONSOLE, not a page.
 *
 * `/account` is deliberately absent: it sits in the normal marketplace frame
 * (a customer reading their rentals is still on the site), so it keeps the
 * footer like every other public page.
 */
const CONSOLE_PREFIXES = ["/admin", "/agency"] as const;

/**
 * `/admin/accept-invite` lives under `/admin` for a tidy URL but is a PUBLIC
 * account-creation screen reached from an emailed link — the admin layout
 * already skips the console chrome for it, so the footer belongs there too.
 */
const CONSOLE_EXCEPTIONS = ["/admin/accept-invite"] as const;

function inConsole(pathname: string): boolean {
  if (CONSOLE_EXCEPTIONS.some((p) => pathname === p)) return false;
  return CONSOLE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * RENDERS ITS CHILDREN EVERYWHERE EXCEPT INSIDE A CONSOLE.
 *
 * ── THE BUG THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * `ConsoleShell` is an APP: it claims exactly the height the site header
 * leaves (`--header-h`) and scrolls its two columns independently.
 * The root layout then hung the marketing footer — logo, Terms, Privacy,
 * Support — underneath it, with `mt-20` on top.
 *
 * So the console measured one full screen and the DOCUMENT measured one
 * screen plus the footer, which gave every console page TWO scrollbars: the
 * panel scrolling its own content, and the window scrolling to reveal a
 * marketing footer nobody wanted under a queue of bookings. Measured on
 * production at 1536x695: the window scrolled 386px, which was the footer's
 * height to the pixel.
 *
 * Hiding it rather than restructuring is deliberate for now. The idiomatic
 * fix is route groups — one frame for the public site, another for the
 * console — but that moves every route directory, and this repo is carrying
 * a large uncommitted working tree. This is two files and no moves.
 *
 * ── WHY A CLIENT COMPONENT ───────────────────────────────────────────────
 *
 * The root layout is a server component and cannot read the pathname. The
 * children stay server-rendered: they are passed through as a prop, so
 * nothing in the footer becomes client code — only this decision does.
 */
export function MarketplaceOnly({ children }: { children: React.ReactNode }) {
  if (inConsole(usePathname())) return null;
  return <>{children}</>;
}
