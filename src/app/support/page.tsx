import type { Metadata } from "next";
import Link from "next/link";
import { CancellationPolicySummary } from "@/modules/legal/components/cancellation-policy";
import {
  ContentSection,
  ContentShell,
} from "@/shared/components/content-section";
import { LEGAL } from "@/shared/config/legal";
import { SUPPORT_EMAIL, SUPPORT_PATH } from "@/shared/config/support";
import { AGENCY_SIGNUP_PATH, HOST_SIGNUP_PATH } from "@/shared/config/supply";
import { pageMetadata } from "@/shared/seo/metadata";
import { BreadcrumbJsonLd } from "@/shared/seo/structured-data";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Support",
    description: `How to reach ${LEGAL.companyName} support: a car that was never handed over, a charge you do not recognise, cancelling a booking, deleting your account, and help for agencies.`,
    path: SUPPORT_PATH,
  });
}

/**
 * /support — the public support page, and the URL the App Store and Play
 * listings point their mandatory Support field at.
 *
 * TWO READERS, IN THIS ORDER. A store reviewer checking that the Support URL
 * resolves and that account deletion can be started from inside the app, and
 * a customer standing in a car park next to a car that never arrived. Both
 * need the same thing from the top of the page: the address of a human and
 * the route to the control that actually fixes their problem.
 *
 * NOTHING HERE IS INVENTED. There is no phone line, no live chat with the
 * platform and no published response time, so the page claims none: email is
 * the only customer-to-platform channel that exists
 * (`shared/config/support.ts`). The cancellation figures come from
 * `GET /legal/current` through the same component the Terms page uses, so
 * this page cannot quote a percentage the server stopped enforcing. The
 * operator's registered name and postal address are deliberately absent —
 * they live behind `NEXT_PUBLIC_LEGAL_*`, which is unset in production, and
 * a support page is the wrong place to print a fallback as if it were a fact.
 * The legal identity belongs to /legal/terms, which already renders it.
 *
 * AND NOTHING HERE IS SOMEWHERE ELSE. Where a control exists on one surface
 * only, this page says which — a reviewer opens the Support URL with an iPhone
 * in their hand, and a customer who is told to press a button their app does
 * not have is worse off than one who was told to write. `Report a problem` is
 * web-only today (`modules/bookings/components/report-problem-notice.tsx`; the
 * app has no equivalent), and the itemised price card is called `Price
 * breakdown` on the web and `Price` in the app. Only `Cancel`, with the
 * server's refund quote, is the same control in both places.
 */

export default function SupportPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}`;
  const linkCls = "text-primary underline underline-offset-2";

  return (
    <ContentShell>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Support", path: SUPPORT_PATH },
        ]}
      />
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground">
          How to reach us, and the fastest route for the things people
          actually write to us about.
        </p>
      </header>

      <ContentSection id="contact" title="1. How to reach us">
        <p>
          Email{" "}
          <a href={mailto} className={linkCls}>
            {SUPPORT_EMAIL}
          </a>
          . Write from the email address on your account, and if your message
          is about a rental, include the booking id — it is shown on the
          booking page, and on the web the{" "}
          <span className="font-medium text-foreground">Report a problem</span>{" "}
          notice described below fills the whole email in for you.
        </p>
        <p>
          Email is the only channel that reaches the {LEGAL.companyName} team:
          there is no support phone line. The chat inside a booking is a
          different thing — it reaches{" "}
          <span className="font-medium text-foreground">
            the agency that owns the car
          </span>
          , which is the right place for a question about the vehicle, the
          pickup or the keys, and the wrong place for a refund we have to
          issue.
        </p>
      </ContentSection>

      <ContentSection id="bookings" title="2. Help with a booking">
        <p>
          Every booking has its own page, under{" "}
          <Link href="/account" className={linkCls}>
            Rentals
          </Link>{" "}
          on the web and in the{" "}
          <span className="font-medium text-foreground">Bookings</span> tab of
          the app. It carries the controls for the three things that go wrong
          most often — and where one of them is on the web only, it says so.
        </p>
        <p>
          <strong className="text-foreground">
            Nobody was there to hand over the car.
          </strong>{" "}
          Open the booking on the web: from the pickup day onwards it shows a{" "}
          <span className="font-medium text-foreground">Report a problem</span>{" "}
          notice with a prefilled email. The app does not have that notice yet,
          so from a phone, email us the booking id and what happened — it
          reaches the same place. Either way, do not cancel first — a
          cancellation after your free window retains part of what you paid
          for the agency, so the person who was left waiting ends up paying
          for it. When an agency fails to deliver the car as agreed, our team
          cancels the booking for you with a full refund regardless of timing.
        </p>
        <p>
          <strong className="text-foreground">
            A charge you do not recognise.
          </strong>{" "}
          Prices on {LEGAL.companyName} are always computed by the server and
          itemised on the booking page — under{" "}
          <span className="font-medium text-foreground">Price breakdown</span>{" "}
          on the web, <span className="font-medium text-foreground">Price</span>{" "}
          in the app: the rental days, delivery if you chose it, tax, the total,
          and any security deposit as its own line.{" "}
          <Link href="/legal/terms#bookings" className={linkCls}>
            Section 4 of the Terms
          </Link>{" "}
          sets out when your card is held and when it is actually charged. If
          the page and your bank statement still disagree, email us the
          booking id and the amount you were charged.
        </p>
        <p>
          <strong className="text-foreground">You want to cancel.</strong>{" "}
          Open the booking and press{" "}
          <span className="font-medium text-foreground">Cancel</span>: before
          you confirm anything, the page shows the exact amount the server
          will refund and the amount, if any, it will retain. That quote — not
          this page — is the number that counts, because it is the one being
          executed.
        </p>
        <p>
          The policy those amounts are calculated from, as it currently
          stands:
        </p>
        <CancellationPolicySummary variant="inline" />
      </ContentSection>

      <ContentSection id="delete-account" title="3. Deleting your account">
        <p>
          You can start this yourself, without writing to us: in the app, go
          to{" "}
          <strong className="text-foreground">
            Profile → Delete account
          </strong>
          , confirm with your password, and the deletion runs immediately.
        </p>
        <p>
          <Link href="/legal/delete-account" className={linkCls}>
            Delete your account
          </Link>{" "}
          sets out exactly what is erased, and what survives because it is
          also the agency&rsquo;s record.
        </p>
        <p>
          <strong className="text-foreground">If you own an agency</strong>,
          the same control does it: deleting your account closes the agency in
          the same step, so there is nothing to request and nobody to write to.
          It is refused only while the business still owes somebody a car or
          money — an unsettled booking, a damage claim still being decided, a
          deposit still held on a renter&rsquo;s card, money in the agency
          wallet or on its way to your bank, or an open card dispute. When that
          happens the app and the dashboard name each one, with the numbers and
          a link to the screen that clears it, and you can delete the account as
          soon as the list is empty.
        </p>
        <p>
          <strong className="text-foreground">
            You still have a booking of your own in progress.
          </strong>{" "}
          Finish or cancel it from{" "}
          <Link href="/account" className={linkCls}>
            Rentals
          </Link>{" "}
          first — the agency is holding a car for you — then delete the
          account.
        </p>
      </ContentSection>

      <ContentSection id="agencies" title="4. Agencies and hosts">
        <p>
          If you rent out cars, most of it is yours to change directly —
          fleet, branches, availability, zones, staff and payouts all live in
          your agency dashboard. For anything you cannot do from there, email
          us{" "}
          <span className="font-medium text-foreground">
            from the address on the agency account
          </span>{" "}
          and name the agency, because fleet, bookings and payouts all hang
          off it.
        </p>
        <p>
          Not signed up yet?{" "}
          <Link href={AGENCY_SIGNUP_PATH} className={linkCls}>
            Apply as a rent-a-car business
          </Link>{" "}
          or{" "}
          <Link href={HOST_SIGNUP_PATH} className={linkCls}>
            list a car you own
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection id="legal" title="5. Terms and privacy">
        <p>
          The{" "}
          <Link href="/legal/terms" className={linkCls}>
            Terms of Service
          </Link>{" "}
          govern bookings, payments, cancellations and the rental agreements
          themselves. The{" "}
          <Link href="/legal/privacy" className={linkCls}>
            Privacy Policy
          </Link>{" "}
          covers what we collect and how long we keep it;{" "}
          <Link href="/legal/privacy#rights" className={linkCls}>
            your rights
          </Link>{" "}
          is the section to read before sending a data request.
        </p>
      </ContentSection>
    </ContentShell>
  );
}
