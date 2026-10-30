import { ShieldCheck, KeyRound, MessagesSquare } from "lucide-react";
import { HeroSearch } from "@/modules/cars/components/hero-search";
import { HostCtaBand } from "@/modules/agencies/components/host-cta-band";
import { pageMetadata, SITE_DESCRIPTION } from "@/shared/seo/metadata";
import { OrganizationJsonLd } from "@/shared/seo/structured-data";

export function generateMetadata() {
  return pageMetadata({
    title: "Car rental in the Dominican Republic and the US",
    description: SITE_DESCRIPTION,
    path: "/",
  });
}

export default function HomePage() {
  return (
    <div>
      <OrganizationJsonLd />
      {/* Hero — two columns on desktop: the message and the search on the
          left, a vehicle on the right. The big isotype used to be the ONLY
          thing on the right, which left that half reading as empty space; it
          is now a secondary detail layered over the photo.

          The right half is a GRADIENT, not a photograph, because no hero
          photograph exists in `public/` yet. It used to be layered as
          `url('/hero/car.jpg'), linear-gradient(…)` so that dropping the file
          in would light it up with no code change — but a CSS background
          layer is requested whether or not it resolves, so every single home
          page load fetched a missing file and logged a 404 (BUG-004). The
          affordance was not worth a permanent error in every visitor's
          console and in our own monitoring.

          To use a real photo: add it under `public/hero/`, then put the image
          layer back in front of the gradient on the div below.

          Top padding came down from pt-20/md:pt-28 so the search sits higher
          in the fold and the page invites scrolling instead of filling the
          whole screen with the headline. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--accent-soft)_0%,transparent_55%),radial-gradient(ellipse_at_bottom_left,var(--olive-soft)_0%,transparent_50%),linear-gradient(180deg,var(--gold-soft)_0%,var(--background)_70%)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* The photograph BLEEDS off the right edge instead of sitting in a
            floating card. A rounded panel beside the text read as something
            pasted on rather than as part of the page — and while no real photo
            exists it read as an empty box with no explanation at all.

            It also sits behind the message column rather than beside it, so
            the search below keeps the FULL content width. Splitting the row
            cost the search ~45% of its width and truncated every field
            ("Choose a co…", "Pic…", "Re…"), which broke the one element that
            has to work on this page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block"
        >
          <div className="absolute inset-0 bg-[linear-gradient(130deg,var(--muted)_0%,var(--accent-soft)_60%,var(--surface)_100%)] bg-cover bg-center" />
          {/* Fades the image into the page on its left and bottom edges, so
              there is no hard seam where the photo stops. */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/isotype.png"
            alt=""
            className="absolute -right-10 top-8 h-44 w-44 select-none opacity-[0.10]"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-12 pt-10 md:pb-16 md:pt-14">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Verified local rent-a-car agencies
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-[1.06] tracking-[-0.03em] text-foreground md:text-5xl">
              Find the right car for your next trip.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
              Compare cars from local agencies. Choose your destination and
              dates to get started.
            </p>
          </div>

          {/* Full width again — the fields need the room. */}
          <div className="mt-7">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* How it works — quiet, generous, three clear steps. */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl text-foreground md:text-3xl">
          How Cibaura works
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: KeyRound,
              title: "Request to book",
              body: "Your booking is confirmed by the agency. Your card is only charged when they accept — never before.",
              accent: "bg-accent-soft text-primary",
            },
            {
              icon: ShieldCheck,
              title: "Pickup or delivery",
              body: "Collect the car at a branch, or have it delivered to the airport or your hotel zone for a fixed fee.",
              accent: "bg-gold-soft text-foreground",
            },
            {
              icon: MessagesSquare,
              title: "Chat in-app",
              body: "Coordinate every detail with the agency directly from your booking — pickup, extras, questions.",
              accent: "bg-olive-soft text-olive",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-[var(--radius)] border border-border bg-surface p-6 shadow-sm"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] ${f.accent}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* The supply side, once. Everything above this point speaks to a
          renter; this band is the only thing on the page addressed to the
          person who OWNS the car. Last, so it never competes with the
          search. */}
      <HostCtaBand />
    </div>
  );
}
