import { ShieldCheck, KeyRound, MessagesSquare } from "lucide-react";
import { HeroSearch } from "@/features/cars/components/hero-search";

export default function HomePage() {
  return (
    <div>
      {/* Hero — big, airy, photo-forward. The car is the hero. */}
      <section className="relative overflow-hidden">
        {/* Large background car image behind a warm gradient scrim. */}
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=2000&q=70"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Faint brand isotype watermark — pure decoration. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/isotype.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 -z-10 h-56 w-56 select-none opacity-[0.05] md:h-80 md:w-80"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-14 pt-20 md:pb-24 md:pt-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Verified local rent-a-car agencies
            </span>
            <h1 className="font-display mt-5 text-4xl leading-[1.05] text-foreground md:text-6xl">
              Find the perfect car,
              <br />
              rented by people nearby.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Pick a city and your dates, compare real cars from verified
              agencies, and book in minutes — no counter, no surprises.
            </p>
          </div>

          <div className="mt-8">
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
    </div>
  );
}
