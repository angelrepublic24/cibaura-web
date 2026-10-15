import Link from "next/link";
import { KeyRound } from "lucide-react";
import {
  AGENCY_SIGNUP_PATH,
  HOST_SIGNUP_LABEL,
  HOST_SIGNUP_PATH,
} from "@/shared/config/supply";

/**
 * Homepage supply band — the ONE place on the landing page that speaks to the
 * other side of the marketplace. It closes the page, after "How Cibaura
 * works", so the demand story is told first and uninterrupted.
 *
 * Deliberately a band and not a section: three sentences and a single button.
 * The detailed pitch (benefits, the five wizard steps, the agency fork) is
 * already on `/become-host` — repeating it here would cost the homepage its
 * airiness for no extra conversion.
 *
 * It sits on `--navy`, the only surface where the brand's Neon (#00E7FF) is
 * legible: 12.4:1 on navy against 1.51:1 on the light canvas. So Neon appears
 * exactly here — the eyebrow and the button fill — and nowhere on the light
 * page above it.
 *
 * Contained and rounded rather than full-bleed: the footer is also `bg-navy`,
 * and two edge-to-edge dark strips separated by a strip of page background
 * read as a seam. As a panel inside the content column it reads as a
 * deliberate card, and the page keeps its light, airy close.
 *
 * A server component: static copy, no session. Visitors who already supply
 * cars see it too, which is harmless on a page they rarely load; the header
 * link is the one that is session-aware.
 */
export function HostCtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4">
      <div className="flex flex-col gap-8 rounded-[var(--radius-lg)] bg-navy px-6 py-10 md:flex-row md:items-center md:justify-between md:gap-12 md:px-10">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neon">
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            For car owners
          </p>
          <h2 className="mt-3 font-display text-2xl text-navy-foreground md:text-3xl">
            Earn from a car that sits idle
          </h2>
          {/* Payout wording tracks /legal/terms: earnings are credited to the
              wallet when a booking settles, and withdrawn to the registered
              bank account on request — not paid out automatically per rental. */}
          <p className="mt-3 text-sm leading-relaxed text-cream/80 md:text-base">
            Set your own daily rate, accept only the requests you like, and
            withdraw your earnings to your bank account. Listing is free — you
            pay a commission only when you get a booking.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          <Link
            href={HOST_SIGNUP_PATH}
            className="inline-flex h-11 items-center rounded-[var(--radius-sm)] bg-neon px-6 text-sm font-semibold text-neon-foreground transition-opacity hover:opacity-90"
          >
            {HOST_SIGNUP_LABEL}
          </Link>
          {/* Capped: the column is `shrink-0`, so an uncapped 49-character
              caption would hand the footnote more width than the message. */}
          <p className="text-xs text-cream/70 md:max-w-[15rem] md:text-right">
            Running a rent-a-car business?{" "}
            <Link
              href={AGENCY_SIGNUP_PATH}
              className="font-medium text-cream underline underline-offset-2 hover:text-neon"
            >
              Apply as an agency
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
