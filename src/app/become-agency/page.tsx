"use client";

import Link from "next/link";

import {
  BadgeCheck,
  CalendarClock,
  Car,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useMe } from "@/modules/auth/hooks/auth.hook";
import { useAuthStore } from "@/shared/auth/store";
import { useAgencySession } from "@/modules/agency/hooks/agency.hook";
import {
  AgencyAccessRevoked,
  isRevokedStatus,
} from "@/modules/agency/components/access-revoked";
import { ApplyForm } from "@/modules/agencies/components/apply-form";
import { AGENCY_SIGNUP_PATH, HOST_SIGNUP_PATH } from "@/shared/config/supply";
import { LoadingState } from "@/shared/components/states";
import { buttonVariants } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
/**
 * /become-agency — the "list your cars" funnel. Leads with the value
 * proposition (why list on Cibaura), then routes by session into the KYC
 * application + document-upload flow.
 */

/**
 * THIS IS A RECRUITMENT PAGE: every sentence below is a promise made to an
 * agency owner before they sign anything, so each one carries the backend file
 * that DECIDES the rule it describes. When a money or lifecycle rule moves,
 * that file is where the new truth lives — and this is the page that has to
 * follow it.
 */
const BENEFITS = [
  {
    icon: Car,
    title: "Reach more renters",
    // Verified against backend fleet.service.ts: activating a car needs a
    // VERIFIED agency AND `assertListingEligible` (signed host agreement, and
    // for an individual host the car's registration). Verification on its own
    // publishes nothing — the agency still activates each car.
    body: "Customers search Cibaura by city and dates. Once your agency is verified, every car you activate shows up in front of people ready to book.",
  },
  {
    icon: Wallet,
    title: "You set the price, keep your rate",
    // Verified against backend pricing.service.ts: the commission is a MARKUP
    // on the renter's side (`withCommissionCents`) and the host is credited
    // `hostDailyRateCents × days` exactly — even the rounding remainders are
    // absorbed by the platform, never by the agency.
    body: "You set your daily rate and are credited every cent of it. Cibaura's commission is added on top of your price for the renter — it never comes out of your earnings.",
  },
  {
    icon: MapPin,
    title: "Earn on delivery too",
    // Verified against backend pricing.service.ts: `hostDeliveryFeeCents` is
    // part of `hostSubtotalCents`, and the renter's delivery fee is that same
    // figure marked up — the commission does not eat into the fee you set.
    body: "Set a fee to deliver a car to the airport, a hotel zone or anywhere else you serve — you're credited that fee in full, just like your daily rate.",
  },
  {
    icon: ShieldCheck,
    title: "Get paid safely",
    // Verified against backend booking-capture.job.ts (`findDue`): the card is
    // charged when `free_cancellation_until` passes, NOT on acceptance —
    // accepting leaves the hold in place. The wallet credit happens at
    // `settleBooking` (bookings.service.ts).
    body: "The renter's card is held when they request, and charged once their free-cancellation window closes — not the moment you accept. Your share is credited to your wallet when the rental settles, and you can follow every cent of it there.",
  },
  {
    icon: LayoutDashboard,
    title: "A full dashboard",
    // Verified against backend agency.controller.ts / agency.service.ts:
    // branches, manual blocks and walk-in bookings, and staff whose access is
    // scoped per branch (`assertBranchInScope`).
    body: "Manage your fleet, calendar and offline bookings, review requests, and add staff with roles & per-branch permissions.",
  },
  {
    icon: CalendarClock,
    title: "No upfront cost",
    // Verified against the backend: there is no listing fee, subscription or
    // plan key in `platform_config` (platform-config.service.ts). The
    // commission in pricing.service.ts is the platform's only cut, and it only
    // exists once a booking is priced.
    body: "Listing is free: no monthly fee and nothing to pay to join. Cibaura earns its commission only when a booking actually happens.",
  },
];

const STEPS = [
  // Step 1 mirrors the real application: the form, then
  // business_registration + owner_id, then the host agreement
  // (modules/agencies/components/apply-form.tsx).
  { n: 1, title: "Apply", body: "Tell us about your agency, upload a couple of documents and sign the host agreement." },
  // NO TURNAROUND TIME. Nothing in the backend defines a review SLA, so the
  // old "usually within a few business days" was a promise no code could keep.
  // What IS guaranteed: every verification decision notifies the owner
  // (account-notifications.listener.ts, AGENCY_VERIFICATION_CHANGED_EVENT), and
  // a pending applicant may already build their fleet as drafts
  // (fleet.service.ts only gates ACTIVATION on verification).
  { n: 2, title: "Get verified", body: "A Cibaura admin reviews your application and documents, and we let you know as soon as there's a decision. You can start preparing your fleet while you wait." },
  { n: 3, title: "List & earn", body: "Activate your cars, set your prices, and start receiving booking requests." },
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
        <p className="mt-4 text-sm text-muted-foreground">
          Renting out your own car, not running a business?{" "}
          <Link
            href={HOST_SIGNUP_PATH}
            className="font-medium text-primary hover:underline"
          >
            Become a private host instead
          </Link>
          .
        </p>
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
  // verified → dashboard; pending → the upload step; rejected/suspended →
  // the access-revoked state (rejection is terminal — no re-submit).
  const sessionQuery = useAgencySession(
    status === "authenticated" && isMember,
  );
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
              href={`/auth/login?next=${AGENCY_SIGNUP_PATH}`}
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
      if (isRevokedStatus(verificationStatus)) {
        // Owner rule: a rejected agency lost the platform — the backend 403s
        // document upload/list too, so the old "re-submit" flow is gone.
        return (
          <AgencyAccessRevoked
            status={verificationStatus}
            reason={sessionQuery.data?.agency.verificationReason}
          />
        );
      }
      // Pending owner → let them upload documents.
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
