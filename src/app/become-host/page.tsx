"use client";

import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import { useAgencySession } from "@/features/agency/hooks";
import {
  AgencyAccessRevoked,
  isRevokedStatus,
} from "@/features/agency/access-revoked";
import { HostWizard } from "@/features/agencies/components/host-wizard";
import { LoadingState } from "@/shared/components/states";
import { buttonVariants } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

/**
 * /become-host — the "rent out your own car" funnel for individual owners
 * (ADR-0009). Leads with the value proposition, then routes by session:
 * guests log in first; customers start the five-step wizard; pending hosts
 * resume it; verified hosts get the dashboard; business agencies are sent
 * to theirs (one supply entity per user).
 */

const BENEFITS = [
  {
    icon: Banknote,
    title: "Earn from a car that sits idle",
    body: "Set your own daily rate. Renters pay a service fee on top — it never comes out of what you earn.",
  },
  {
    icon: CalendarDays,
    title: "You stay in control",
    body: "Accept only the requests you like, block the dates you need the car, and hand it over at your address or deliver it.",
  },
  {
    icon: ShieldCheck,
    title: "Protected every rental",
    body: "A signed rental agreement, a security deposit held on the renter's card, and photo check-in / check-out on every booking.",
  },
  {
    icon: KeyRound,
    title: "Paid to your bank",
    body: "Earnings land in your wallet after each rental and are paid out to your Dominican bank account.",
  },
];

const STEPS = [
  { n: 1, title: "About you", body: "Your name, cédula and phone." },
  { n: 2, title: "Your address", body: "Where renters pick up the car." },
  { n: 3, title: "Your ID", body: "A photo of both sides of your cédula." },
  { n: 4, title: "Host agreement", body: "Read and sign it online." },
  { n: 5, title: "Your first car", body: "Photos, price and its registration card." },
];

function ValueProp() {
  return (
    <section className="mb-12">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        For private owners
      </p>
      <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">
        Rent out your car on Cibaura
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Turn your own car into income without running a rental business.
        Verified hosts only — renters are identity-checked, every rental is
        covered by a signed agreement and a deposit, and you decide who drives
        your car.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-[var(--radius)] border border-border bg-surface p-5 shadow-sm"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[var(--radius)] border border-border bg-muted/40 p-5">
        <h2 className="font-display text-lg text-foreground">
          Five steps, about ten minutes
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-5">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {s.n}
              </span>
              <div>
                <p className="font-medium text-foreground">{s.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Running a rent-a-car business with several branches?{" "}
          <Link href="/become-agency" className="font-medium text-primary hover:underline">
            Apply as an agency instead
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

export default function BecomeHostPage() {
  useMe(); // hydrate the session store
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const hasRole = useAuthStore((s) => s.hasRole);
  const isMember = hasRole("agency_owner", "agency_staff");

  const sessionQuery = useAgencySession(status === "authenticated" && isMember);
  const agency = sessionQuery.data?.agency;

  function body() {
    if (status === "unknown" || !user) {
      if (status === "guest") {
        return (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div>
                <h2 className="font-display text-lg text-foreground">
                  Log in to start
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You need a Cibaura account to become a host. Log in and
                  we&apos;ll bring you right back here.
                </p>
              </div>
              <Link
                href="/auth/login?next=/become-host"
                className={buttonVariants({ variant: "default" })}
              >
                Log in to continue
              </Link>
              <p className="text-sm text-muted-foreground">
                New to Cibaura?{" "}
                <Link
                  href="/auth/register"
                  className="font-medium text-primary hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </CardContent>
          </Card>
        );
      }
      return <LoadingState label="Checking your session…" />;
    }

    if (isMember) {
      if (sessionQuery.isLoading) {
        return <LoadingState label="Loading your host profile…" />;
      }
      if (agency && agency.kind !== "individual") {
        return (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div>
                <h2 className="font-display text-lg text-foreground">
                  You already manage an agency
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {agency.name} is set up as a rent-a-car agency. Add your
                  cars from its dashboard — an account can run one supply
                  profile.
                </p>
              </div>
              <Link href="/agency" className={buttonVariants({ variant: "default" })}>
                Go to agency dashboard
              </Link>
            </CardContent>
          </Card>
        );
      }
      if (isRevokedStatus(agency?.verificationStatus)) {
        return <AgencyAccessRevoked reason={agency?.verificationReason} />;
      }
      // Pending or verified individual host → the wizard resumes / confirms.
      return <HostWizard userId={user.id} isMember />;
    }

    return <HostWizard userId={user.id} isMember={false} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ValueProp />
      {body()}
    </div>
  );
}
