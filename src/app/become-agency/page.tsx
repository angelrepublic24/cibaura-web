"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  Car,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/shared/auth/store";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { ApplyForm } from "@/features/agencies/components/apply-form";
import { LoadingState } from "@/shared/components/states";
import { buttonVariants } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

/**
 * /become-agency — the "list your cars" funnel. Leads with the value
 * proposition (why list on Cibaura), then routes by session into the KYC
 * application + document-upload flow.
 */

const BENEFITS = [
  {
    icon: Car,
    title: "Reach more renters",
    body: "Customers search Cibaura by city and dates. The moment you're verified, your cars show up in front of people ready to book.",
  },
  {
    icon: Wallet,
    title: "You set the price, keep your rate",
    body: "You set your daily rate and keep it. The renter pays a small platform fee on top — it never comes out of your earnings.",
  },
  {
    icon: MapPin,
    title: "Earn on delivery too",
    body: "Charge a fee to deliver a car to the airport, a hotel zone, or anywhere else — it's added to what you earn.",
  },
  {
    icon: ShieldCheck,
    title: "Get paid safely",
    body: "The renter's card is held when they request and charged only when YOU accept. No shows, no surprises — track it all in your wallet.",
  },
  {
    icon: LayoutDashboard,
    title: "A full dashboard",
    body: "Manage your fleet, calendar and offline bookings, review requests, and add staff with roles & per-branch permissions.",
  },
  {
    icon: CalendarClock,
    title: "No upfront cost",
    body: "Listing is free. You only pay a commission when you actually get a booking — nothing before that.",
  },
];

const STEPS = [
  { n: 1, title: "Apply", body: "Tell us about your agency and upload a couple of documents." },
  { n: 2, title: "Get verified", body: "Our team reviews your application — usually within a few business days." },
  { n: 3, title: "List & earn", body: "Add your cars, set your prices, and start receiving booking requests." },
];

function ValueProp() {
  return (
    <section className="mb-12">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        For rental agencies
      </p>
      <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">
        Grow your rent-a-car business on Cibaura
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Put your fleet in front of renters searching across cities, keep your
        own rates, and manage everything from one dashboard. Verified agencies
        only — so customers trust who they rent from.
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
        <h2 className="font-display text-lg text-foreground">How it works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
      </div>
    </section>
  );
}

export default function BecomeAgencyPage() {
  useMe(); // hydrate the session store
  const status = useAuthStore((s) => s.status);
  const hasRole = useAuthStore((s) => s.hasRole);
  const isMember = hasRole("agency_owner", "agency_staff");

  // For an existing member, the verification status decides what they see:
  // verified → dashboard; pending/rejected → the upload / re-submit step.
  const sessionQuery = useQuery({
    queryKey: agencyKeys.session(),
    queryFn: () => AgencyApi.session(),
    enabled: status === "authenticated" && isMember,
    staleTime: 60_000,
  });
  const verificationStatus = sessionQuery.data?.agency.verificationStatus;

  function application() {
    if (status === "unknown") {
      return <LoadingState label="Checking your session…" />;
    }
    if (status === "guest") {
      return (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div>
              <h2 className="font-display text-lg text-foreground">
                Log in to apply
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You need a Cibaura account to apply as an agency. Log in and
                we&apos;ll bring you right back here.
              </p>
            </div>
            <Link
              href="/auth/login?next=/become-agency"
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
    if (isMember) {
      if (sessionQuery.isLoading) {
        return <LoadingState label="Loading your agency…" />;
      }
      if (verificationStatus === "verified") {
        return (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">
                <BadgeCheck className="h-4 w-4" /> Verified agency
              </span>
              <div>
                <h2 className="font-display text-lg text-foreground">
                  You&apos;re all set
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage your fleet, bookings and documents from the agency
                  dashboard.
                </p>
              </div>
              <Link href="/agency" className={buttonVariants({ variant: "default" })}>
                Go to agency dashboard
              </Link>
            </CardContent>
          </Card>
        );
      }
      // Pending or rejected owner → let them upload / re-submit documents.
      return <ApplyForm alreadyApplied status={verificationStatus} />;
    }
    // Plain customer → the full application flow.
    return <ApplyForm />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ValueProp />
      {application()}
    </div>
  );
}
